import { defineConfig, devices } from "@playwright/test";

const PORT = 3101;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E config for the marketing site. Unlike the app, marketing has no backend
 * (no Supabase/Stripe/wallet), so the dev server boots with only the two public
 * URL vars set. APP_URL is fixed here so the landing-page CTA href assertions
 * (which point at the app subdomain) are deterministic.
 */
export const APP_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_APP_URL: APP_URL,
      NEXT_PUBLIC_MARKETING_URL: BASE_URL,
    },
  },
});
