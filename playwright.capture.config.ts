import { defineConfig, devices } from "@playwright/test";

/** One-off config for landing screenshot capture — reuses existing dev server. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "capture-landing-screenshots.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3002",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- -p 3002",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
  },
});