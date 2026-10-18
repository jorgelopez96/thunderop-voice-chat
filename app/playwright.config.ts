import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  timeout: 90_000,
  use: { channel: 'msedge', baseURL: 'http://127.0.0.1:1420' },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: false,
    env: { VITE_PB_URL: 'http://127.0.0.1:8091' },
  },
});
