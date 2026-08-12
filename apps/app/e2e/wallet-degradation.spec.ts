import { test, expect } from "@playwright/test";

/**
 * src/lib/cards/queries.ts's fetchOne() discards the Supabase query error and
 * returns `null` whenever the lookup fails — including when it fails because
 * the backend is unreachable (fake project URL here). Both wallet routes
 * treat a null card as "not found" and return 404 before ever attempting to
 * build a pass, so this is the only branch reachable via black-box E2E
 * without a live DB. The documented 503 apple_wallet_unavailable /
 * google_wallet_unavailable graceful-degradation path (pass-build failure
 * for a card that *does* exist) is NOT reachable this way — see e2e/README.md.
 */
test.describe("Wallet route degradation (no live DB)", () => {
  test("GET /api/wallet/apple/<token> returns 404 not_found", async ({
    request,
  }) => {
    const res = await request.get("/api/wallet/apple/fake-token-123");
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  test("GET /api/wallet/google/<token> returns 404 not_found", async ({
    request,
  }) => {
    const res = await request.get("/api/wallet/google/fake-token-123");
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
