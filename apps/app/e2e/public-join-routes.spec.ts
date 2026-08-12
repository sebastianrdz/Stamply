import { test, expect } from "@playwright/test";
import esDict from "@stamply/i18n/dictionaries/es.json";

/**
 * Both public "join" pages look up their record via the admin (service-role)
 * Supabase client. The e2e env points at a non-existent Supabase project, so
 * every lookup comes back as an ERROR (not a clean "no rows") — which means
 * these specs exercise the pages' error branch added in the launch-hardening
 * pass: a real backend failure now renders a friendly "something went wrong"
 * state (HTTP 200) instead of a misleading "not found". The genuine not-found
 * path needs a live DB returning zero rows and is covered at the query layer
 * by src/lib/cards/queries.test.ts.
 *
 * Verified against a dev server booted with the same fake env:
 *   GET /join/<token>  -> 200, h1 "Algo salió mal" (dict.join.error)
 *   GET /c/join/<uuid> -> 200, h1 "Algo salió mal" (dict.customerJoin.error)
 */
test.describe("Public join/invite routes (backend error path)", () => {
  test("/join/<token> renders the friendly error state when the lookup fails", async ({
    page,
  }) => {
    const response = await page.goto("/join/nonexistent-token-xyz");
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: esDict.join.error.title }),
    ).toBeVisible();
    await expect(page.getByText(esDict.join.error.description)).toBeVisible();
  });

  test("/c/join/<programId> renders the friendly error state when the lookup fails", async ({
    page,
  }) => {
    const response = await page.goto(
      "/c/join/00000000-0000-0000-0000-000000000000",
    );
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: esDict.customerJoin.error.title }),
    ).toBeVisible();
    await expect(
      page.getByText(esDict.customerJoin.error.description),
    ).toBeVisible();
  });
});
