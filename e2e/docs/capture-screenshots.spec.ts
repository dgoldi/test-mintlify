import { test as base, Page } from '@playwright/test';
import { getMetadata } from '../helpers';
import { postCustomerSignUp, PostAddressResource } from '../lib/pos-client';
import { DATE_TIME_PICKER_FORMAT, formatDate } from '../lib/format-date';
import { SUPERUSERS } from '../auth-superuser/auth-superuser.resources';
import { Environments } from '../auth-superuser/auth-superuser.type';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getLocaleConfig } from './locale-config';

const test = base.extend({});

/**
 * Logs in and captures the bearer token from network traffic,
 * mirroring the approach in auth-superuser.init.ts.
 */
async function loginAndGetToken(page: Page, baseUrl: string, serviceUrl: string, environment: string): Promise<string> {
  const user = SUPERUSERS[environment as Environments] ?? SUPERUSERS.dev;

  // Set up response interceptor BEFORE login to avoid race conditions
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().startsWith(serviceUrl) && !!resp.request().headers()['authorization'],
  );

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('input[name=username]').fill(user.username);
  await page.locator('input[type=password]').fill(user.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(`${baseUrl}/**`, { timeout: 60_000 });

  // Capture the bearer token from the first API request the app makes after login
  const response = await responsePromise;
  const bearerToken = response.request().headers()['authorization'];

  await page.waitForTimeout(1000);

  return bearerToken;
}

test('capture: admin field config and QR code', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const { imagesDir: DOCS_IMAGES_DIR, videosDir } = getLocaleConfig(testInfo.project.use.locale as string);

  await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);
  await page.goto(`${config.adminUrl}/customer-sign-up`);
  await page.waitForSelector('[data-test-id="pwaAdmin#purchaseSettings.page"]');

  // Wait for QR code canvas to render
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1000);

  // Screenshot 1: Full page showing field config (left) and QR code (right)
  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'feldkonfiguration.png'),
    fullPage: false,
  });

  // Screenshot 2: QR code section only
  const qrSection = page.locator('canvas').first();
  await qrSection.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'qr-code.png'),
  });

  // Save recorded video to docs
  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'field-config-qr-code.webm'));
});

test('capture: POS customer form with prefilled sign-up data', async ({ page }, testInfo) => {
  const config = getMetadata(testInfo);
  const { imagesDir: DOCS_IMAGES_DIR, videosDir, acceptLanguage } = getLocaleConfig(testInfo.project.use.locale as string);

  // Log in via admin to get a bearer token for API calls
  const bearerToken = await loginAndGetToken(page, config.adminUrl, config.adminServiceUrl, config.environment);

  const headers = {
    Authorization: bearerToken,
    'Accept-Language': acceptLanguage,
  };

  const signUpAddress: PostAddressResource = {
    firstName: 'Anna',
    lastName: 'Muster',
    street: 'Bahnhofstrasse',
    houseNo: '10',
    zipCode: '8001',
    town: 'Zürich',
    countryCode: 'CH',
    type: 'CUSTOMER',
  };

  const signedUpCustomer = await postCustomerSignUp(
    config.posServiceUrl,
    {
      firstName: 'Anna',
      lastName: 'Muster',
      companyName: null,
      dateOfBirth: formatDate(new Date('1990-05-15'), DATE_TIME_PICKER_FORMAT),
      gender: 'FEMALE',
      email: null,
      emails: [
        {
          type: 'PRIVATE',
          email: `anna.muster.${randomUUID()}@beispiel.ch`,
        },
      ],
      website: null,
      phone: null,
      phones: [
        {
          type: 'PRIVATE',
          phoneNumber: '+41 44 123 45 67',
        },
      ],
      membershipCard: null,
      note: null,
      ignoreForLoyalty: false,
      addresses: [signUpAddress],
    },
    headers,
  );

  // Navigate to POS — Auth0 session from admin login carries over
  await page.goto(config.posUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Select a store if prompted ("Filiale auswählen")
  const storeButton = page.getByRole('button', { name: /Danieli/ });
  try {
    await storeButton.click({ timeout: 10_000 });
    await page.waitForTimeout(1000);
  } catch {
    // Store already selected or not required
  }

  await page.goto(`${config.posUrl}/customers/create?hash=${signedUpCustomer.hash}`);

  // Wait for form to be populated with sign-up data
  await page.waitForSelector('[data-test-id="customers@customerFormFields.firstName"]');
  await page.waitForTimeout(1000);

  // Screenshot 3: Customer form with prefilled data
  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, 'pos-kundenerfassung.png'),
    fullPage: false,
  });

  // Save recorded video to docs
  fs.mkdirSync(videosDir, { recursive: true });
  await page.close();
  await page.video()?.saveAs(path.join(videosDir, 'pos-customer-registration.webm'));
});
