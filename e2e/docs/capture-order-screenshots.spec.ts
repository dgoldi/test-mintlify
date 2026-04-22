import { test as base, Page } from '@playwright/test';
import { getMetadata } from '../helpers';
import { SUPERUSERS } from '../auth-superuser/auth-superuser.resources';
import { Environments } from '../auth-superuser/auth-superuser.type';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getLocaleConfig } from './locale-config';

const test = base.extend({});

/**
 * Logs in and captures the bearer token from network traffic.
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

  await page.keyboard.press('Escape');
  await input.clear();
  return false;
}

test('capture: order management flow', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const locale = testInfo.project.use.locale as string;
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(locale);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  // ------------------------------------------------------------------
  // Step 1: Orders list page
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/orders`);
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'auftraege-liste.png'),
    fullPage: false,
  });

  // ------------------------------------------------------------------
  // Step 2: Navigate to order creation form
  // ------------------------------------------------------------------
  await page.goto(`${config.adminUrl}/orders/create`);
  await page.waitForSelector('[data-test-id="pwaAdmin#ordersCreate"]');
  await page.waitForTimeout(1000);

  // Fill supplier
  await selectFirstAvailableOption(page, 'pwaAdmin#orderFormFields.supplier', `${config.inventoryServiceUrl}/suppliers`);
  await page.waitForTimeout(500);

  // Fill store
  await selectFirstAvailableOption(page, 'pwaAdmin#orderFormFields.store', `${config.adminServiceUrl}/stores`);
  await page.waitForTimeout(500);

  // Fill optional order reference
  await page.getByTestId('pwaAdmin#orderFormFields.orderReference').fill('VO-2026-001');

  // Screenshot the filled form
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'auftrag-formular.png'),
    fullPage: true,
  });

  // ------------------------------------------------------------------
  // Step 3: Save the order
  // ------------------------------------------------------------------
  const submitButton = page.getByTestId('pwaAdmin#createOrderForm.submit');

  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().startsWith(`${config.inventoryServiceUrl}/orders`) && resp.request().method() === 'POST',
    ),
    submitButton.click(),
  ]);

  // Wait for redirect to order detail page
  await page.waitForURL(`${config.adminUrl}/orders/*/articles`, { timeout: 15_000 });
  await page.waitForTimeout(1500);

  // ------------------------------------------------------------------
  // Step 4: Screenshot order detail with article search
  // ------------------------------------------------------------------
  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'auftrag-artikel-hinzufuegen.png'),
    fullPage: false,
  });

  // ------------------------------------------------------------------
  // Step 5: Add an article to the order
  // ------------------------------------------------------------------
  const modelSelect = page.getByTestId('pwaAdmin#ordersIdArticles.modelSelect');
  const modelInput = modelSelect.locator('input').locator('visible=true');

  const articleAdded = await (async () => {
    for (const query of ['a', 'e', 'n', 's', 'o', 'b', 'c', 'i', 't']) {
      await modelInput.fill(query);
      await page.waitForTimeout(500);

      const option = page.getByRole('option').first();
      if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
        await option.click();
        await page.waitForTimeout(1500);
        return true;
      }
    }
    return false;
  })();

  if (articleAdded) {
    await page.screenshot({
      path: path.join(DOCS_IMAGES_DIR, 'auftrag-mengen.png'),
      fullPage: false,
    });
  }

  // ------------------------------------------------------------------
  // Step 6: Screenshot "Create article" option in search
  // ------------------------------------------------------------------
  await modelInput.fill('Neuer-Testartikel-XYZ');
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'auftrag-artikel-erstellen.png'),
    fullPage: false,
  });

  // Clear the search
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ------------------------------------------------------------------
  // Step 7: Change order status
  // ------------------------------------------------------------------
  const stateDropdown = page.getByTestId('pwaAdmin#stateChangeButtons.state');
  await stateDropdown.click();
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'auftrag-status-aendern.png'),
    fullPage: false,
  });

  // Set to ORDERED
  const orderedOption = page.getByTestId('pwaAdmin#stateChangeButtons.state.ORDERED');
  if (await orderedOption.isVisible({ timeout: 1000 }).catch(() => false)) {
    await orderedOption.click();
    await page.waitForTimeout(1000);
  }

  // ------------------------------------------------------------------
  // Step 8: Screenshot send order button/modal
  // ------------------------------------------------------------------
  const sendButton = page.getByTestId('pwaAdmin#orderHeaderActionBar.sendOrder');
  if (await sendButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sendButton.click();
    await page.waitForTimeout(1000);

    const sendModal = page.getByTestId('pwaAdmin#sendOrderModal.modal');
    if (await sendModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({
        path: path.join(DOCS_IMAGES_DIR, 'auftrag-versenden.png'),
        fullPage: false,
      });

      // Close modal
      await page.keyboard.press('Escape');
    }
  }

  // ------------------------------------------------------------------
  // Clean up: delete the test order
  // ------------------------------------------------------------------
  // Set back to DRAFT for deletion
  const stateDropdown2 = page.getByTestId('pwaAdmin#stateChangeButtons.state');
  await stateDropdown2.click();
  await page.waitForTimeout(300);
  const draftOption = page.getByTestId('pwaAdmin#stateChangeButtons.state.DRAFT');
  if (await draftOption.isVisible({ timeout: 1000 }).catch(() => false)) {
    await draftOption.click();
    await page.waitForTimeout(500);
  }

  // Save recorded video to docs
  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'order-management-flow.webm'));
});
