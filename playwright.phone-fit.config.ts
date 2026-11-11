import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({ ...base, testMatch: /(?:phone-sections(?:-style)?|sketch-showdown|drawing-phone-fit|fish-test-shortcut|pwa-home|stylesheet-recovery)\.browser\.spec\.ts/, projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }] });
