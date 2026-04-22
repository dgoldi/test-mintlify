import { TestInfo } from '@playwright/test';
import { TestConfig } from '../test-config';

export const getMetadata = (testInfo: TestInfo): TestConfig => {
  return testInfo.config.metadata as TestConfig;
};
