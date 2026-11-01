import { defineConfig, devices } from '@playwright/test';
import { acquireE2eLock } from './support/e2e-lock.mjs';
import { getE2eEnv } from './support/env.mjs';

// Before anything heavy (webServers) starts; released in global-teardown. See support/e2e-lock.mjs.
acquireE2eLock();

const env = getE2eEnv();

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  // One shared DB schema: tests reset it, so they must not run in parallel.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  globalTeardown: './support/global-teardown.ts',
  use: {
    baseURL: env.webUrl,
    trace: 'retain-on-failure',
    // Narrow viewport: the bottom tab bar is hidden from 768px up.
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
  },
  projects: [
    // `pnpm e2e:smoke`: tests tagged @smoke, screenshot attached to every test.
    { name: 'smoke', grep: /@smoke/, use: { screenshot: 'on' } },
    // `pnpm e2e:full`: everything.
    { name: 'full', use: { screenshot: 'only-on-failure' } },
  ],
  webServer: [
    {
      command: 'node support/start-api.mjs',
      url: `${env.apiUrl}/api/v1/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'node support/start-web.mjs',
      url: env.webUrl,
      timeout: 600_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
