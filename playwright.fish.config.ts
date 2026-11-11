import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testMatch: /(?:fish-finale|fish-shark|fish-controls|fish-runtime|fish-test-shortcut|fish-standalone|sketch-showcase|spray-quality)\.browser\.spec\.ts/,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
