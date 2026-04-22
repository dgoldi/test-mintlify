import { PlaywrightTestConfig } from '@playwright/test';
import { metadata } from './e2e/test-config';

/**
 * Lightweight Playwright config for capturing documentation screenshots.
 * Expects pwa-admin and pwa-pos (and pwa-office / pwa-stocktaking as needed)
 * to already be running in the subsidia-web-applications monorepo.
 *
 * Runs every test twice — once per locale — to produce both German and English
 * screenshots, written to images/{de,en}/ and videos/{de,en}/.
 */
const sharedUse = {
  viewport: { width: 1280, height: 800 },
  timezoneId: 'Europe/Zurich',
  testIdAttribute: 'data-test-id',
  ignoreHTTPSErrors: true,
  screenshot: 'off' as const,
  trace: 'off' as const,
  video: { mode: 'on' as const, size: { width: 1280, height: 800 } },
};

const config: PlaywrightTestConfig = {
  testDir: './e2e/docs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'list' : 'html',
  expect: { timeout: 10_000 },
  metadata: {
    ...metadata,
    adminUrl: metadata.adminUrl.replace('http://', 'https://'),
    posUrl: metadata.posUrl.replace('http://', 'https://'),
  },
  use: sharedUse,
  projects: [
    {
      name: 'screenshots-de',
      use: { ...sharedUse, locale: 'de-CH' },
    },
    {
      name: 'screenshots-en',
      use: { ...sharedUse, locale: 'en' },
    },
  ],
};

export default config;
