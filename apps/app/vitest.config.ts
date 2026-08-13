import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest config for unit/integration tests of "pure-ish" server logic
 * (billing, RBAC helpers, wallet payload construction, utilities, server
 * actions with mocked Supabase clients).
 *
 * Next 16 async Server Components are NOT unit-tested here (Vitest can't
 * render them) — see node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md.
 * Those are covered by Playwright E2E specs in e2e/ instead.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**"],
    },
  },
});
