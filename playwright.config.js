import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8001',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 8001',
    port: 8001,
    reuseExistingServer: true,
    timeout: 120_000
  },
  reporter: [['list']]
});
