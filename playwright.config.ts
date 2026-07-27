import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && python3 -m http.server 3100 --bind 127.0.0.1 --directory out',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      NEXT_PUBLIC_TMDB_READ_ACCESS_TOKEN: 'e2e-token',
      NEXT_PUBLIC_REQUIRE_GITHUB_IN_DEV: 'false',
    },
  },
});
