import { test as base, Page } from '@playwright/test';
import { getMetadata } from '../helpers';
import { SUPERUSERS } from '../auth-superuser/auth-superuser.resources';
import { Environments } from '../auth-superuser/auth-superuser.type';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getLocaleConfig } from './locale-config';

const test = base.extend({});

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

test('capture: minimum stock (NOS)', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  await page.goto(`${config.adminUrl}/nos`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'mindestbestand-liste.png'), fullPage: false });

  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'minimum-stock-flow.webm'));
});

test('capture: receipt settings', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  await page.goto(`${config.adminUrl}/epos-template-settings`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'beleg-einstellungen-liste.png'), fullPage: false });

  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'receipt-settings-flow.webm'));
});

test('capture: currency settings', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  await page.goto(`${config.adminUrl}/purchase-settings`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'einkaufseinstellungen.png'), fullPage: false });

  await page.goto(`${config.adminUrl}/sale-settings`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'verkaufseinstellungen.png'), fullPage: false });

  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'currency-settings-flow.webm'));
});

test('capture: gift cards', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  await page.goto(`${config.adminUrl}/giftcards`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'geschenkkarten-liste.png'), fullPage: false });

  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'gift-cards-flow.webm'));
});

test('capture: bank details for QR invoices', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  await page.goto(`${config.adminUrl}/bank-details`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'bankverbindungen.png'), fullPage: false });

  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'qr-invoice-flow.webm'));
});
