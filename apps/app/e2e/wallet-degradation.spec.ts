import { test, expect } from "@playwright/test";

/**
 * Both wallet routes look up the card via the admin (service-role) Supabase
 * client. The e2e env points at a non-existent Supabase project, so the lookup
 * fails with an ERROR (not a clean "no rows"). After the launch-hardening pass
 * the routes surface that as a 503 "temporarily unavailable" — the correct
 * signal for a backend outage — rather than a misleading 404 not_found. The
 * genuine not_found path (a live backend returning zero rows) needs a real DB
 * and is covered at the query layer by src/lib/cards/queries.test.ts.
 */
test.describe("Wallet route degradation (no live DB)", () => {
  test("GET /api/wallet/apple/<token> returns 503 when the lookup fails", async ({
    request,
  }) => {
    const res = await request.get("/api/wallet/apple/fake-token-123");
    expect(res.status()).toBe(503);
    expect(await res.json()).toEqual({ error: "apple_wallet_unavailable" });
  });

  test("GET /api/wallet/google/<token> returns 503 when the lookup fails", async ({
    request,
  }) => {
    const res = await request.get("/api/wallet/google/fake-token-123");
    expect(res.status()).toBe(503);
    expect(await res.json()).toEqual({ error: "google_wallet_unavailable" });
  });
});
