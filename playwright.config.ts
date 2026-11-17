import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** The tests that every browser engine runs, not only Chromium. */
const ENGINE_TESTS = /determinism\.spec\.ts/;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/animalplanet/`,
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The other two browser engines play the determinism matches only: what
    // they must show is that they count the same as Chromium. They are on in
    // CI (E2E_ALL_BROWSERS=1), where all three browsers are installed.
    ...(process.env.E2E_ALL_BROWSERS
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: ENGINE_TESTS },
          { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: ENGINE_TESTS },
        ]
      : []),
  ],
  webServer: {
    // Tests run against the production build, so run `npm run build` first.
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/animalplanet/`,
    reuseExistingServer: !process.env.CI,
  },
});
