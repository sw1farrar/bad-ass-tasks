import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for Badazz Tasks.
 * Run with: npm run test:e2e
 * First time: npx playwright install
 * 
 * Targets: Chrome + Mobile (Pixel) + Safari for broad coverage.
 * CI friendly (headed false, retries).
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  // Screenshot capture has its own config (npm run capture:landing) — keep CI fast & deterministic.
  testIgnore: ['**/capture-landing-screenshots.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    // Isolated port + cleared Supabase env → pure demo mode (no auth landing gate).
    // CI: use pre-built app (ci.yml build step) — prod server is ready in seconds.
    // Local: dev-start.mjs ignores `-p`; PORT env is how Next binds to 3001.
    command: process.env.CI
      ? 'npx next start -p 3001'
      : 'node scripts/dev-start.mjs',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 60_000 : 180_000,
    env: {
      ...process.env,
      PORT: '3001',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    },
  },
});
