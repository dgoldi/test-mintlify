#!/usr/bin/env python3
"""Generate one combined PDF per locale from the MDX help-center docs.

Usage:
    python3 scripts/generate-pdfs.py

Output:
    /help-center-en.pdf
    /help-center-de.pdf

Ported from the subsidia-web-applications `docs/generate-pdfs.py` (same CSS,
same annotation/callout logic). Differences:
  - Reads .mdx (strips YAML frontmatter + injected <video> block)
  - One combined PDF per locale, page order driven by docs.json
  - Image refs are absolute (/images/{locale}/foo.png) → rewritten to file://
"""

from __future__ import annotations

import html as html_lib
import json
import os
import re
from pathlib import Path
from typing import Iterable

import markdown
from weasyprint import HTML

ROOT = Path(__file__).resolve().parent.parent
DOCS_JSON = ROOT / "docs.json"
IMAGES_ROOT = ROOT / "images"
OUT = {
    "en": ROOT / "help-center-en.pdf",
    "de": ROOT / "help-center-de.pdf",
}

# Callout positions are shared across languages (same UI layout).
CALLOUT_POSITIONS = {
    "feldkonfiguration.png": [
        {"label": "A", "top": "18%", "left": "88%"},
        {"label": "B", "top": "18%", "left": "92%"},
        {"label": "C", "top": "18%", "left": "96%"},
    ],
    "artikel-liste.png": [{"label": "A", "top": "6%", "left": "90%"}],
    "auftraege-liste.png": [{"label": "A", "top": "6%", "left": "90%"}],
    "inventuren-liste.png": [{"label": "A", "top": "6%", "left": "90%"}],
}

LEGENDS = {
    "de": {
        "feldkonfiguration.png": "<b>A</b> Pflichtfeld — <b>B</b> Sichtbar — <b>C</b> Ausgeblendet",
        "qr-code.png": "Diesen QR-Code drucken oder digital teilen.",
        "pos-kundenerfassung.png": "Das Formular wird automatisch mit den Registrierungsdaten befüllt.",
        "artikel-liste.png": "<b>A</b> Artikel erfassen",
        "artikel-formular.png": "Links: Artikelangaben, Saison/Kollektion, Preise. Rechts: Varianten.",
        "artikel-angaben.png": "Artikelangaben mit Pflichtfeldern: Marke, Lieferant, Artikel-Nummer, Kategorie.",
        "artikel-saison.png": "Saison und Kollektion sind optional.",
        "artikel-preise.png": "Einkaufspreis und Verkaufspreis sind Pflichtfelder.",
        "artikel-varianten.png": "Farben und Material sind optional. Die Grössen-Dimension ist ein Pflichtfeld.",
        "artikel-uebersicht.png": "Artikelübersicht mit Tabs nach erfolgreicher Erstellung.",
        "auftraege-liste.png": "<b>A</b> Auftrag erfassen",
        "auftrag-formular.png": "Auftragsformular mit Lieferant, Filiale und Lieferdaten.",
        "auftrag-artikel-hinzufuegen.png": "Auftragsübersicht im Status Entwurf mit Artikelsuche.",
        "auftrag-mengen.png": "Bestellmengen pro Farbe und Grösse erfassen.",
        "auftrag-artikel-erstellen.png": "Neuen Artikel direkt aus dem Auftrag erstellen.",
        "auftrag-status-aendern.png": "Auftragsstatus über die Dropdown-Auswahl ändern.",
        "auftrag-versenden.png": "Bestellung per E-Mail an Markenvertreter versenden.",
        "inventuren-liste.png": "<b>A</b> Inventur vorbereiten",
        "inventur-formular.png": "Filiale und Startzeitpunkt festlegen.",
        "inventur-uebersicht.png": "Übersicht mit Fortschritt und Teilnahme-Link.",
        "inventur-starten.png": "Inventur auf dem Tab Erweitert starten.",
        "inventur-differenzen.png": "Differenzliste mit Soll- und Ist-Mengen.",
        "inventur-artikel-detail.png": "Artikeldetail mit Varianten und manueller Mengenanpassung.",
        "inventur-abschliessen.png": "Inventur auf dem Tab Erweitert abschliessen.",
        "artikel-varianten-liste.png": "Variantenliste mit Preisspalten (EP, VP, UVP).",
        "artikel-bearbeiten-modal.png": "Bearbeitungsfenster mit Eigenschaften und Preisfeldern.",
        "artikel-bilder-upload.png": "Übersicht-Tab mit Bilder-Upload.",
        "artikel-varianten-loeschen.png": "Varianten auswählen und löschen.",
        "artikel-varianten-wiederherstellen.png": "Inaktive Varianten anzeigen und wiederherstellen.",
        "artikel-loeschen-erweitert.png": "Ganzen Artikel auf dem Tab Erweitert löschen.",
        "lieferanten-liste.png": "Lieferantenliste unter Einstellungen > Meine Lieferanten.",
        "lieferant-konfigurieren.png": "Neuen Lieferanten mit Adresse und Währung konfigurieren.",
        "marken-liste.png": "Markenliste unter Einstellungen > Meine Marken.",
        "lieferant-marken-verknuepfung.png": "Marken mit Lieferant verknüpfen und Preisfaktoren hinterlegen.",
        "benutzer-liste.png": "Benutzerliste unter Einstellungen > Benutzer.",
        "benutzer-formular.png": "Benutzerformular mit Name, E-Mail und Rollen.",
        "schichten-liste.png": "Schichtenliste unter Einstellungen.",
        "schicht-formular.png": "Schicht-Formular mit Name, Filiale und Kontaktdaten.",
        "saisons-liste.png": "Saisonliste mit Konfiguration.",
        "kollektionen-liste.png": "Kollektionenliste mit Erstellen-Schaltfläche.",
        "rabatte-liste.png": "Rabattliste mit Schaltfläche Rabatt hinzufügen.",
        "rabatt-formular.png": "Rabatt-Formular mit Typ und Einschränkungen.",
        "mindestbestand-liste.png": "Mindestbestandliste mit Artikeln und Filialen.",
        "beleg-einstellungen-liste.png": "Beleg-Einstellungen Übersicht.",
        "einkaufseinstellungen.png": "Einkaufs-Einstellungen mit Wechselkursen.",
        "verkaufseinstellungen.png": "Verkaufs-Einstellungen mit Wechselkursen und Aufschlägen.",
        "geschenkkarten-liste.png": "Geschenkkartenliste.",
        "bankverbindungen.png": "Bankverbindungen für QR-Rechnungen.",
    },
    "en": {
        "feldkonfiguration.png": "<b>A</b> Required — <b>B</b> Visible — <b>C</b> Hidden",
        "qr-code.png": "Print this QR code or share it digitally.",
        "pos-kundenerfassung.png": "The form is automatically populated with the registration data.",
        "artikel-liste.png": "<b>A</b> Add Article",
        "artikel-formular.png": "Left: Model details, season/collection, prices. Right: Variations.",
        "artikel-angaben.png": "Model details with required fields: Brand, Supplier, Article Number, Category.",
        "artikel-saison.png": "Season and collection are optional.",
        "artikel-preise.png": "Purchase price and sales price are required fields.",
        "artikel-varianten.png": "Colors and material are optional. The size dimension is a required field.",
        "artikel-uebersicht.png": "Article overview with tabs after successful creation.",
        "auftraege-liste.png": "<b>A</b> Create Order",
        "auftrag-formular.png": "Order form with supplier, store and delivery dates.",
        "auftrag-artikel-hinzufuegen.png": "Order overview in Draft status with article search.",
        "auftrag-mengen.png": "Enter order quantities per color and size.",
        "auftrag-artikel-erstellen.png": "Create a new article directly from the order.",
        "auftrag-status-aendern.png": "Change order status via the dropdown selector.",
        "auftrag-versenden.png": "Send order via email to brand representative.",
        "inventuren-liste.png": "<b>A</b> Prepare Stocktaking",
        "inventur-formular.png": "Select store and start time.",
        "inventur-uebersicht.png": "Overview with progress and participation link.",
        "inventur-starten.png": "Start stocktaking on the Advanced tab.",
        "inventur-differenzen.png": "Differences list with expected and actual quantities.",
        "inventur-artikel-detail.png": "Article detail with variants and manual quantity adjustment.",
        "inventur-abschliessen.png": "Confirm stocktaking on the Advanced tab.",
        "artikel-varianten-liste.png": "Variant list with price columns (PP, SP, MSRP).",
        "artikel-bearbeiten-modal.png": "Edit modal with attributes and price fields.",
        "artikel-bilder-upload.png": "Overview tab with image upload.",
        "artikel-varianten-loeschen.png": "Select and delete variants.",
        "artikel-varianten-wiederherstellen.png": "Show inactive variants and restore them.",
        "artikel-loeschen-erweitert.png": "Delete entire article on the Advanced tab.",
        "lieferanten-liste.png": "Supplier list under Settings > My Suppliers.",
        "lieferant-konfigurieren.png": "Configure new supplier with address and currency.",
        "marken-liste.png": "Brand list under Settings > My Brands.",
        "lieferant-marken-verknuepfung.png": "Link brands to supplier and configure price factors.",
        "benutzer-liste.png": "User list under Settings > Users.",
        "benutzer-formular.png": "User form with name, email and roles.",
        "schichten-liste.png": "Shifts list under Settings.",
        "schicht-formular.png": "Shift form with name, store and contact details.",
        "saisons-liste.png": "Seasons list with configuration.",
        "kollektionen-liste.png": "Collections list with create button.",
        "rabatte-liste.png": "Discounts list with Add Discount button.",
        "rabatt-formular.png": "Discount form with type and restrictions.",
        "mindestbestand-liste.png": "Minimum stock list with articles and stores.",
        "beleg-einstellungen-liste.png": "Receipt settings overview.",
        "einkaufseinstellungen.png": "Purchase settings with exchange rates.",
        "verkaufseinstellungen.png": "Sales settings with exchange rates and markups.",
        "geschenkkarten-liste.png": "Gift cards list.",
        "bankverbindungen.png": "Bank details for QR invoices.",
    },
}

PLACEHOLDER_TEXT = {"de": "Screenshot folgt:", "en": "Screenshot pending:"}

CSS = """
@page {
    size: A4;
    margin: 2.5cm 2cm;
    @bottom-right {
        content: counter(page) " / " counter(pages);
        font-size: 9pt;
        color: #999;
    }
}
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
}
h1 {
    font-size: 20pt;
    margin-bottom: 0.3em;
    color: #111;
    border-bottom: 2px solid #e5e5e5;
    padding-bottom: 0.3em;
    page-break-before: always;
    bookmark-level: 1;
}
h1:first-of-type { page-break-before: avoid; }
h2 {
    font-size: 15pt;
    margin-top: 1.5em;
    color: #222;
    bookmark-level: 2;
}
h3 {
    font-size: 12pt;
    margin-top: 1.2em;
    color: #333;
}
hr {
    border: none;
    border-top: 1px solid #e5e5e5;
    margin: 1.5em 0;
}
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 10pt; }
th, td { border: 1px solid #d0d0d0; padding: 8px 12px; text-align: left; }
th { background-color: #f5f5f5; font-weight: 600; }
tr:nth-child(even) { background-color: #fafafa; }
blockquote {
    border-left: 4px solid #0066cc;
    background-color: #f0f6ff;
    padding: 12px 16px;
    margin: 1em 0;
    font-size: 10pt;
}
blockquote p { margin: 0; }
code { background-color: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-size: 9.5pt; }
ul, ol { padding-left: 1.5em; }
li { margin-bottom: 0.3em; }
a { color: #0066cc; text-decoration: none; }
.screenshot-container { position: relative; margin: 1.5em 0; page-break-inside: avoid; }
.screenshot-container img { width: 100%; border: 1px solid #e0e0e0; border-radius: 4px; }
.callout {
    position: absolute;
    background: #0066cc;
    color: white;
    width: 22px; height: 22px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; line-height: 22px; text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.screenshot-legend { font-size: 9pt; color: #666; margin-top: 0.5em; font-style: italic; }
.screenshot-placeholder {
    background-color: #f5f5f5;
    border: 2px dashed #ccc;
    border-radius: 4px;
    padding: 2em; text-align: center; color: #999; font-size: 10pt;
    margin: 1.5em 0;
}
.cover {
    height: 90vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
    page-break-after: always;
}
.cover h1 {
    border: none; padding: 0;
    font-size: 32pt; color: #111;
    page-break-before: avoid;
}
.cover .subtitle { font-size: 14pt; color: #666; margin-top: 0.5em; }
.toc { page-break-after: always; }
.toc h1 { bookmark-level: 1; }
.toc ul { list-style: none; padding-left: 0; }
.toc li { margin: 0.5em 0; font-size: 11pt; }
.toc a {
    color: #111;
    text-decoration: none;
    display: flex;
    align-items: baseline;
}
.toc a .title { order: 0; }
.toc a::before {
    content: "";
    flex: 1;
    border-bottom: 1px dotted #bbb;
    margin: 0 0.4em;
    order: 1;
    transform: translateY(-3px);
}
.toc a::after {
    content: target-counter(attr(href url), page);
    color: #888;
    order: 2;
}
"""

COVER_TITLES = {
    "en": ("Subsidia Help Center", "User guides — English"),
    "de": ("Subsidia Hilfe-Center", "Anleitungen — Deutsch"),
}

TOC_TITLES = {"en": "Table of Contents", "de": "Inhaltsverzeichnis"}


# ------------- MDX preprocessing -------------

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
VIDEO_BLOCK_RE = re.compile(
    r"\{/\*\s*video:injected\s*\*/\}\s*"
    r"(?:<video\b[^>]*?/>|<video\b[^>]*?>.*?</video>)\s*",
    re.DOTALL,
)
TITLE_RE = re.compile(r"^title:\s*['\"]?(.*?)['\"]?\s*$", re.MULTILINE)


def preprocess_mdx(mdx: str) -> tuple[str, str | None]:
    """Strip frontmatter + injected <video> block. Return (markdown, title)."""
    title: str | None = None
    m = FRONTMATTER_RE.match(mdx)
    if m:
        fm = m.group(1)
        tm = TITLE_RE.search(fm)
        if tm:
            title = tm.group(1).replace("''", "'").strip()
        mdx = mdx[m.end():]
    mdx = VIDEO_BLOCK_RE.sub("", mdx)
    return mdx, title


# ------------- image rewriting -------------

IMG_TAG_RE = re.compile(
    r'<img\s+([^>]*?)src="/images/(en|de)/([^"]+)"([^>]*?)/?>',
    re.IGNORECASE,
)


def image_exists(lang: str, filename: str) -> bool:
    return (IMAGES_ROOT / lang / filename).is_file()


def build_annotation_html(lang: str, filename: str, alt: str) -> str:
    if not image_exists(lang, filename):
        return (
            f'<div class="screenshot-placeholder">'
            f'{PLACEHOLDER_TEXT[lang]} {alt}</div>'
        )
    img_uri = (IMAGES_ROOT / lang / filename).as_uri()
    legends = LEGENDS.get(lang, LEGENDS["en"])
    callouts_html = "".join(
        f'<div class="callout" style="top:{c["top"]};left:{c["left"]}">{c["label"]}</div>'
        for c in CALLOUT_POSITIONS.get(filename, [])
    )
    legend = legends.get(filename, "")
    legend_html = f'<div class="screenshot-legend">{legend}</div>' if legend else ""
    return (
        f'<div class="screenshot-container">'
        f'<img src="{img_uri}" alt="{alt}" />'
        f'{callouts_html}'
        f'</div>{legend_html}'
    )


def rewrite_images(html: str, lang: str) -> str:
    def replace(match: re.Match) -> str:
        attrs_before = match.group(1)
        src_lang = match.group(2)
        filename = match.group(3)
        alt_match = re.search(r'alt="([^"]*)"', attrs_before)
        alt = alt_match.group(1) if alt_match else ""
        return build_annotation_html(src_lang, filename, alt)
    return IMG_TAG_RE.sub(replace, html)


# ------------- navigation order from docs.json -------------

def page_order(lang: str) -> list[str]:
    """Return list of MDX stems in docs.json order for the given locale."""
    cfg = json.loads(DOCS_JSON.read_text(encoding="utf-8"))
    for entry in cfg["navigation"]["languages"]:
        if entry["language"] == lang:
            result: list[str] = []
            for group in entry.get("groups", []):
                for page in group.get("pages", []):
                    # pages look like "en/creating-articles" → take stem
                    if "/" in page:
                        prefix, stem = page.split("/", 1)
                        if prefix == lang:
                            result.append(stem)
            return result
    raise RuntimeError(f"locale {lang!r} not in docs.json navigation.languages")


# ------------- assembly -------------

def build_body(lang: str) -> str:
    stems = page_order(lang)
    cover_title, subtitle = COVER_TITLES[lang]
    parts: list[str] = [
        f'<div class="cover"><h1>{html_lib.escape(cover_title)}</h1>'
        f'<div class="subtitle">{html_lib.escape(subtitle)}</div></div>'
    ]

    chapters: list[tuple[str, str, str]] = []  # (stem, title, html_body)
    for stem in stems:
        mdx_path = ROOT / lang / f"{stem}.mdx"
        if not mdx_path.is_file():
            print(f"  skip (missing): {lang}/{stem}.mdx")
            continue
        raw = mdx_path.read_text(encoding="utf-8")
        md_text, title = preprocess_mdx(raw)
        title = title or stem.replace("-", " ").title()
        html_body = markdown.markdown(md_text, extensions=["tables", "fenced_code"])
        html_body = rewrite_images(html_body, lang)
        chapters.append((stem, title, html_body))

    # Table of Contents (between cover and first chapter)
    toc_items = "\n".join(
        f'<li><a href="#{stem}"><span class="title">{html_lib.escape(title)}</span></a></li>'
        for stem, title, _ in chapters
    )
    parts.append(
        f'<div class="toc"><h1>{html_lib.escape(TOC_TITLES[lang])}</h1>'
        f'<ul>{toc_items}</ul></div>'
    )

    # Chapters
    for stem, title, html_body in chapters:
        parts.append(
            f'<h1 id="{stem}">{html_lib.escape(title)}</h1>\n{html_body}'
        )
    return "\n".join(parts)


def generate_pdf(lang: str) -> None:
    body = build_body(lang)
    full_html = (
        f'<!DOCTYPE html><html lang="{lang}">'
        f'<head><meta charset="utf-8"><style>{CSS}</style></head>'
        f'<body>{body}</body></html>'
    )
    out = OUT[lang]
    HTML(string=full_html, base_url=str(ROOT)).write_pdf(str(out))
    size_kb = out.stat().st_size // 1024
    print(f"Created: {out.name} ({size_kb} KB)")


def main() -> None:
    for lang in ("en", "de"):
        print(f"== {lang} ==")
        generate_pdf(lang)


if __name__ == "__main__":
    main()
