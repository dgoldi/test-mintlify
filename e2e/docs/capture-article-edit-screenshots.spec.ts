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

test('capture: article editing flow', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  // ------------------------------------------------------------------
  // Step 1: Navigate to article list and open first article
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/models`);
  await page.waitForSelector('[data-test-id="models"]');
  await page.waitForTimeout(1500);

  // Click first article in the list
  const firstArticle = page.locator('main a[href*="/models/"]').first();
  await firstArticle.click();
  await page.waitForTimeout(1500);

  // ------------------------------------------------------------------
  // Step 2: Variants tab — article list with prices
  // ------------------------------------------------------------------
  // Navigate to the articles/variants tab
  const articlesTab = page.locator('a[href*="/articles"]').filter({ hasText: /Varianten|Articles/i });
  if (await articlesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await articlesTab.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'artikel-varianten-liste.png'),
    fullPage: false,
  });

  // ------------------------------------------------------------------
  // Step 3: Open edit modal for first article
  // ------------------------------------------------------------------
  const editButton = page.getByTestId('pwaAdmin#articleTableRow.edit').first();
  if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await editButton.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(DOCS_IMAGES_DIR, 'artikel-bearbeiten-modal.png'),
      fullPage: false,
    });

    // Close modal
    const dismissButton = page.getByTestId('designSystem@formModal.dismiss');
    if (await dismissButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dismissButton.click();
      await page.waitForTimeout(500);
    }
  }

  // ------------------------------------------------------------------
  // Step 4: Overview tab — images section
  // ------------------------------------------------------------------
  const overviewTab = page.locator('a[href*="/overview"]').filter({ hasText: /Übersicht|Overview/i });
  if (await overviewTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await overviewTab.click();
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(DOCS_IMAGES_DIR, 'artikel-bilder-upload.png'),
      fullPage: false,
    });
  }

  // Save recorded video
  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'article-editing-flow.webm'));
});
