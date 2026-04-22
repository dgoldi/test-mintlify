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

test('capture: supplier and brand configuration', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  // ------------------------------------------------------------------
  // Step 1: Supplier settings list
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/supplier-settings`);
  await page.waitForSelector('[data-test-id="pwaAdmin#supplierSettings.page"]');
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'lieferanten-liste.png'),
    fullPage: false,
  });

  // ------------------------------------------------------------------
  // Step 2: Supplier create page
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/supplier-settings/create`);
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'lieferant-konfigurieren.png'),
    fullPage: false,
  });

  // ------------------------------------------------------------------
  // Step 3: Brands list
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/brands`);
  await page.waitForSelector('[data-test-id="pwaAdmin#brands.page"]');
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'marken-liste.png'),
    fullPage: false,
  });

  // ------------------------------------------------------------------
  // Step 4: Open first supplier to show brand linking
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/supplier-settings`);
  await page.waitForTimeout(1500);

  const firstSupplier = page.locator('main a[href*="/supplier-settings/"]').first();
  if (await firstSupplier.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstSupplier.click();
    await page.waitForTimeout(1500);

    // Navigate to brands tab
    const brandsTab = page.getByTestId('pwaAdmin#supplierSettingsId.navigation.brands');
    if (await brandsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await brandsTab.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: path.join(DOCS_IMAGES_DIR, 'lieferant-marken-verknuepfung.png'),
        fullPage: false,
      });
    }
  }

  // Save recorded video
  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'supplier-brand-config-flow.webm'));
});
