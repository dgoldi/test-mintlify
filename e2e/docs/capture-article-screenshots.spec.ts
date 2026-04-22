import { test as base, Page, TestInfo } from '@playwright/test';
import { getMetadata } from '../helpers';
import { SUPERUSERS } from '../auth-superuser/auth-superuser.resources';
import { Environments } from '../auth-superuser/auth-superuser.type';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getLocaleConfig } from './locale-config';

const test = base.extend({});

/**
 * Logs in and captures the bearer token from network traffic,
 * mirroring the approach in capture-screenshots.spec.ts.
 */
async function loginAndGetToken(page: Page, baseUrl: string, serviceUrl: string, environment: string): Promise<string> {
  const user = SUPERUSERS[environment as Environments] ?? SUPERUSERS.dev;

  const responsePromise = page.waitForResponse(
    (resp) => resp.url().startsWith(serviceUrl) && !!resp.request().headers()['authorization'],
  );

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('input[name=username]').fill(user.username);
  await page.locator('input[type=password]').fill(user.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(`${baseUrl}/**`, { timeout: 60_000 });

  const response = await responsePromise;
  const bearerToken = response.request().headers()['authorization'];

  await page.waitForTimeout(1000);

  return bearerToken;
}

/**
 * Selects the first available option from a react-select async dropdown.
 *
 * Instead of pre-fetching entity names via a separate API call (which may use
 * different filters than the form's own select), this function triggers the
 * form's search, intercepts its response, extracts the first available name,
 * and selects it. This guarantees the name exists in the filtered dropdown.
 */
async function selectFirstAvailableOption(page: Page, testId: string, serviceUrl: string): Promise<boolean> {
  const locator = page.getByTestId(testId);
  const input = locator.locator('input').locator('visible=true');

  for (const query of ['a', 'e', 'n', 's', 'o', 'b', 'c', 'i', 't', 'l', 'h', 'w', 'u', 'd']) {
    await Promise.all([
      input.fill(query),
      page.waitForResponse((resp) => resp.url().startsWith(serviceUrl) && resp.status() === 200),
    ]);

    await page.waitForTimeout(300);

    const option = page.getByRole('option').first();
    if (await option.isVisible({ timeout: 500 }).catch(() => false)) {
      await option.click();
      return true;
    }
  }

  // No results found — close dropdown and continue
  await page.keyboard.press('Escape');
  await input.clear();
  return false;
}

/**
 * Takes a screenshot of a form section identified by its H4 heading text.
 * The heading's parent is the CardWrapper (FlexColumn) which contains
 * both the heading and the Card with form fields.
 */
async function screenshotSection(page: Page, headingText: string, filePath: string): Promise<void> {
  const heading = page.locator('h4').filter({ hasText: headingText });
  await heading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  // CardWrapper (FlexColumn) is the direct parent of the H4
  const section = heading.locator('..');
  await section.screenshot({ path: filePath });
}

test('capture: article creation flow', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir, headings, testData } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  // ------------------------------------------------------------------
  // Step 1: Article listing page
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/models`);
  await page.waitForSelector('[data-test-id="models"]');
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'artikel-liste.png'),
    fullPage: false,
  });

  // ------------------------------------------------------------------
  // Navigate to the article creation form
  // ------------------------------------------------------------------
  await page.getByTestId('pwaAdmin#models.create').locator('visible=true').click();
  await page.waitForSelector('[data-test-id="pwaAdmin#createModelTemplate.page"]');
  await page.waitForTimeout(1000);

  // Full-page screenshot of the complete empty form (both columns)
  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'artikel-formular.png'),
    fullPage: true,
  });

  // ------------------------------------------------------------------
  // Step 2: Fill Artikelangaben
  // ------------------------------------------------------------------
  await selectFirstAvailableOption(page, 'pwaAdmin#createModelForm.brand', `${config.inventoryServiceUrl}/brands`);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);

  // If supplier was not auto-selected after brand selection, select manually
  const supplierText = await page.getByTestId('pwaAdmin#createModelForm.supplier').textContent();
  if (!supplierText || supplierText.trim().length < 2) {
    await selectFirstAvailableOption(
      page,
      'pwaAdmin#createModelForm.supplier',
      `${config.inventoryServiceUrl}/suppliers`,
    );
  }

  await page.getByTestId('pwaAdmin#createModelForm.name').fill('T-Shirt Basic 2024');
  await page.getByTestId('pwaAdmin#createModelForm.description').fill(testData.description);

  await selectFirstAvailableOption(
    page,
    'pwaAdmin#createModelForm.category',
    `${config.inventoryServiceUrl}/categories`,
  );

  await page.waitForTimeout(500);

  await screenshotSection(page, headings.modelDetails, path.join(DOCS_IMAGES_DIR, 'artikel-angaben.png'));

  // ------------------------------------------------------------------
  // Step 3: Fill Saison & Kollektion
  // ------------------------------------------------------------------
  await selectFirstAvailableOption(page, 'pwaAdmin#createModelForm.season', `${config.inventoryServiceUrl}/seasons`);
  await selectFirstAvailableOption(
    page,
    'pwaAdmin#createModelForm.collection',
    `${config.inventoryServiceUrl}/collections`,
  );

  await page.waitForTimeout(300);

  await screenshotSection(page, headings.season, path.join(DOCS_IMAGES_DIR, 'artikel-saison.png'));

  // ------------------------------------------------------------------
  // Step 4: Fill Preise
  // ------------------------------------------------------------------
  const purchasePriceInput = page.getByTestId('prices@priceForm.purchasePrice');
  await purchasePriceInput.scrollIntoViewIfNeeded();

  await purchasePriceInput.fill('89.90');

  // Tab triggers a price calculation API call — wait for it
  await Promise.all([
    page.waitForResponse((resp) => resp.url().startsWith(`${config.inventoryServiceUrl}/calculate/prices`)).catch(() => {}),
    page.keyboard.press('Tab'),
  ]);

  await page.getByTestId('prices@priceForm.salesPrice').fill('199.95');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);

  await screenshotSection(page, headings.price, path.join(DOCS_IMAGES_DIR, 'artikel-preise.png'));

  // ------------------------------------------------------------------
  // Step 5: Fill Varianten
  // ------------------------------------------------------------------

  // Colors
  const colorsInput = page.getByTestId('pwaAdmin#createModelForm.colors.input');
  await colorsInput.scrollIntoViewIfNeeded();

  for (const color of testData.colors) {
    await colorsInput.fill(color);
    await page.getByTestId('pwaAdmin#createModelForm.colors.add').click();
    await page.waitForTimeout(200);
  }

  // Sizes — select size system then pick available sizes
  const sizeSystemSelected = await selectFirstAvailableOption(
    page,
    'pwaAdmin#createModelForm.sizeDimensions',
    `${config.inventoryServiceUrl}/sizesystems`,
  );

  if (sizeSystemSelected) {
    await page.waitForTimeout(1000);

    // Clear any pre-selected recommendations (wait for size buttons to load first)
    try {
      const resetButton = page.getByTestId('designSystem@buttonGroup.reset');
      if (await resetButton.isVisible({ timeout: 3000 })) {
        await resetButton.click();
        await page.waitForTimeout(300);
      }
    } catch {
      // No reset button visible — continue
    }

    // Select visible size buttons (up to 4)
    const sizeButtons = page.getByTestId(/^designSystem@buttonGroup\.variation\./);
    let selected = 0;
    const count = await sizeButtons.count();
    for (let i = 0; i < count && selected < 4; i++) {
      const btn = sizeButtons.nth(i);
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ timeout: 3000 });
        await page.waitForTimeout(100);
        selected++;
      }
    }
  }

  // Materials
  const materialsInput = page.getByTestId('pwaAdmin#createModelForm.materials.input');
  await materialsInput.scrollIntoViewIfNeeded();
  await materialsInput.fill(testData.material);
  await page.getByTestId('pwaAdmin#createModelForm.materials.add').click();
  await page.waitForTimeout(300);

  // Screenshot the right column (all three variant sections)
  // The right column is inside the FormBody div that contains "Farb-Varianten"
  const variantenHeading = page.locator('h4').filter({ hasText: headings.colorVariations });
  await variantenHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  // Go up from the heading to CardWrapper, then to FormBody (contains all 3 variant sections)
  const rightColumn = variantenHeading.locator('..').locator('..');
  await rightColumn.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'artikel-varianten.png'),
  });

  // ------------------------------------------------------------------
  // Step 6: Save article and screenshot the result page
  // ------------------------------------------------------------------
  const submitButton = page.getByTestId('pwaAdmin#createModelForm.submit');
  await submitButton.scrollIntoViewIfNeeded();

  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().startsWith(`${config.inventoryServiceUrl}/models`) && resp.request().method() === 'POST' && !resp.url().includes('/variations'),
    ),
    page.waitForResponse(
      (resp) =>
        resp.url().startsWith(`${config.inventoryServiceUrl}/models`) &&
        resp.url().includes('/variations') &&
        resp.request().method() === 'POST',
    ),
    submitButton.click(),
  ]);

  // Wait for navigation to model detail page
  await page.waitForURL(`${config.adminUrl}/models/*/overview`, { timeout: 15_000 });
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'artikel-uebersicht.png'),
    fullPage: false,
  });

  // Save recorded video to docs
  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'article-creation-flow.webm'));
});
