import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// The marketing apex the app links back to (logo, "back home"). Fixed here so
// cross-domain link assertions are deterministic; the marketing app isn't
// booted in this suite.
export const MARKETING_URL = "http://localhost:3001";

/**
 * E2E config. With no live Supabase project and all external services
 * unavailable in CI, we deliberately point the app at obviously-fake
 * Supabase credentials (never the real project — see AGENTS.md / .env.local)
 * so:
 *   - the dev server boots (env.ts only requires the vars to be *present*)
 *   - proxy.ts's supabase.auth.getUser() fails closed (no session) rather
 *     than hitting a real backend, which is exactly the "no user" state we
 *     want for testing public routes, auth-gated redirects, and graceful
 *     degradation of wallet/billing routes.
 *
 * Specs that need a real signed-in session / live DB are out of scope here
 * (see e2e/README.md) and are flagged as manual-QA follow-up.
 */
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
      NEXT_PUBLIC_APP_URL: BASE_URL,
      NEXT_PUBLIC_MARKETING_URL: MARKETING_URL,
      // Fake, non-resolving-to-anything-real Supabase project. Deliberately
      // NOT the real dev project in .env.local — E2E must never touch it.
      NEXT_PUBLIC_SUPABASE_URL: "https://e2e-test-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-fake-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "e2e-fake-service-role-key",
    },
  },
});
