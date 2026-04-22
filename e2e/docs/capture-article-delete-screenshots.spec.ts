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

test('capture: article delete and restore flow', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  // ------------------------------------------------------------------
  // Navigate to article list and open first article
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/models`);
  await page.waitForSelector('[data-test-id="models"]');
  await page.waitForTimeout(1500);

  const firstArticle = page.locator('main a[href*="/models/"]').first();
  await firstArticle.click();
  await page.waitForTimeout(1500);

  // ------------------------------------------------------------------
  // Step 1: Variants tab — show variant list with checkboxes
  // ------------------------------------------------------------------
  const articlesTab = page.locator('a[href*="/articles"]').filter({ hasText: /Varianten|Articles/i });
  if (await articlesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await articlesTab.click();
    await page.waitForTimeout(1500);
  }

  // Select a variant checkbox for the screenshot
  const firstCheckbox = page.getByTestId('pwaAdmin#articleTableRow.checkbox').first();
  if (await firstCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstCheckbox.click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'artikel-varianten-loeschen.png'),
    fullPage: false,
  });

  // Unselect
  if (await firstCheckbox.isVisible().catch(() => false)) {
    await firstCheckbox.click();
    await page.waitForTimeout(300);
  }

  // ------------------------------------------------------------------
  // Step 2: Show inactive variants (restore flow)
  // ------------------------------------------------------------------
  const inactiveCheckbox = page.getByTestId('pwaAdmin#articlesEdit.inactiveCheckbox');
  if (await inactiveCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await inactiveCheckbox.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(DOCS_IMAGES_DIR, 'artikel-varianten-wiederherstellen.png'),
      fullPage: false,
    });

    // Uncheck again
    await inactiveCheckbox.click();
    await page.waitForTimeout(500);
  }

  // ------------------------------------------------------------------
  // Step 3: Advanced tab — delete entire article
  // ------------------------------------------------------------------
  const advancedTab = page.locator('a[href*="/advanced"]').filter({ hasText: /Erweitert|Advanced/i });
  if (await advancedTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await advancedTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(DOCS_IMAGES_DIR, 'artikel-loeschen-erweitert.png'),
      fullPage: false,
    });
  }

  // Save recorded video
  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'article-delete-restore-flow.webm'));
});
