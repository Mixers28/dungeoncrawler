import { defineConfig, devices } from '@playwright/test';

// Port is configurable so the suite can run when 3000 is taken by other software.
// Fail loudly on a bad value instead of binding port 0 (a random port).
const port = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 3000;
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`E2E_PORT must be a valid port number, got: ${process.env.E2E_PORT}`);
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
