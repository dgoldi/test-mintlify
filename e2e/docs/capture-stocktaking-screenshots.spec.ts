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

  await page.keyboard.press('Escape');
  await input.clear();
  return false;
}

test('capture: stocktaking management flow', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  // ------------------------------------------------------------------
  // Step 1: Stocktakings list page
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/stocktakings`);
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'inventuren-liste.png'),
    fullPage: false,
  });

  // ------------------------------------------------------------------
  // Step 2: Create stocktaking form
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/stocktakings/create`);
  await page.waitForSelector('[data-test-id="pwaAdmin#stocktakingsCreate.page"]');
  await page.waitForTimeout(1000);

  // Select store
  await selectFirstAvailableOption(page, 'pwaAdmin#createStocktakingForm.store', `${config.adminServiceUrl}/stores`);
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'inventur-formular.png'),
    fullPage: false,
  });

  // Submit form
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/stocktakings') && response.request().method() === 'POST',
  );

  await page.getByTestId('pwaAdmin#createStocktakingForm.submit').click();

  const createResponse = await responsePromise;

  if (createResponse.status() >= 400) {
    // Store likely has an existing open stocktaking — close the error modal and use it
    const closeButton = page.getByRole('button', { name: /Schliessen|Close/i });
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }

    // Navigate to stocktakings list and click first entry (a link, not table row)
    await page.goto(`${config.adminUrl}/stocktakings`);
    await page.waitForTimeout(2000);

    const firstEntry = page.locator('main a[href*="/stocktakings/"]').first();
    await firstEntry.click();
    await page.waitForTimeout(1500);
  } else {
    // Wait for redirect to overview
    await page.waitForURL(
      (url) => {
        const s = url.toString();
        return s.includes('/stocktakings/') && !s.includes('/create');
      },
      { timeout: 15_000 },
    );
    await page.waitForTimeout(1500);
  }

  // ------------------------------------------------------------------
  // Step 3: Overview tab
  // ------------------------------------------------------------------
  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'inventur-uebersicht.png'),
    fullPage: false,
  });

  // ------------------------------------------------------------------
  // Step 4: Advanced tab — screenshot start or confirm card
  // ------------------------------------------------------------------
  await page.getByTestId('pwaAdmin#stocktakingHeaderNavigation.advanced').click();
  await page.waitForTimeout(1000);

  // If stocktaking is NEW (not auto-started), screenshot and start it
  const startButton = page.getByTestId('pwaAdmin#startStocktakingCard.start');
  if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.screenshot({
      path: path.join(DOCS_IMAGES_DIR, 'inventur-starten.png'),
      fullPage: false,
    });

    await startButton.click();
    await page.waitForTimeout(500);

    const confirmStartButton = page.getByRole('button', { name: /ja, jetzt starten|yes, start now/i });
    if (await confirmStartButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmStartButton.click();
      await page.waitForTimeout(1500);
    }
  } else {
    // Stocktaking already IN_PROGRESS — screenshot the advanced tab with confirm card
    await page.screenshot({
      path: path.join(DOCS_IMAGES_DIR, 'inventur-starten.png'),
      fullPage: false,
    });
  }

  // ------------------------------------------------------------------
  // Step 5: Differences tab (may be empty for fresh stocktaking)
  // ------------------------------------------------------------------
  await page.getByTestId('pwaAdmin#stocktakingHeaderNavigation.differences').click();
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'inventur-differenzen.png'),
    fullPage: false,
  });

  // Try to click into an item detail if items exist
  const firstRow = page.locator('table tbody tr').first();
  if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
    await firstRow.click();
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(DOCS_IMAGES_DIR, 'inventur-artikel-detail.png'),
      fullPage: false,
    });

    // Navigate back
    await page.goBack();
    await page.waitForTimeout(1000);
  }

  // ------------------------------------------------------------------
  // Step 6: Advanced tab — Confirm card (if IN_PROGRESS)
  // ------------------------------------------------------------------
  await page.getByTestId('pwaAdmin#stocktakingHeaderNavigation.advanced').click();
  await page.waitForTimeout(1000);

  const confirmStocktakingButton = page.getByTestId('pwaAdmin#confirmStocktakingCard.confirm');
  if (await confirmStocktakingButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.screenshot({
      path: path.join(DOCS_IMAGES_DIR, 'inventur-abschliessen.png'),
      fullPage: false,
    });
  }

  // ------------------------------------------------------------------
  // Clean up: cancel the test stocktaking
  // ------------------------------------------------------------------
  const cancelButton = page.getByTestId('pwaAdmin#cancelStocktakingCard.cancel');
  if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cancelButton.click();
    await page.waitForTimeout(500);

    const confirmCancel = page.getByRole('button', { name: /ja, jetzt abbrechen|yes, cancel now/i });
    if (await confirmCancel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmCancel.click();
      await page.waitForTimeout(1000);
    }
  }

  // Save recorded video
  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'stocktaking-flow.webm'));
});
