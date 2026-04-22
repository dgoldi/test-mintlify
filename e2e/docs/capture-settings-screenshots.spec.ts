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

test('capture: shifts settings', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  // Shifts list
  await page.goto(`${config.adminUrl}/shifts`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'schichten-liste.png'), fullPage: false });

  // Shifts create form
  await page.goto(`${config.adminUrl}/shifts/create`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'schicht-formular.png'), fullPage: false });

  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'shifts-setup-flow.webm'));
});

test('capture: seasons and collections', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  // Seasons list
  await page.goto(`${config.adminUrl}/seasons`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'saisons-liste.png'), fullPage: false });

  // Collections list
  await page.goto(`${config.adminUrl}/collections`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'kollektionen-liste.png'), fullPage: false });

  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'seasons-collections-flow.webm'));
});

test('capture: discounts', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  // Discounts list
  await page.goto(`${config.adminUrl}/discount-templates`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'rabatte-liste.png'), fullPage: false });

  // Discounts create form
  await page.goto(`${config.adminUrl}/discount-templates/create`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(DOCS_IMAGES_DIR, 'rabatt-formular.png'), fullPage: false });

  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'discounts-flow.webm'));
});
