import { test, expect } from "@playwright/test";

/**
 * Both public "join" pages do a lookup via the admin (service-role) Supabase
 * client against the fake project URL. Without a live DB there is no way to
 * reach the "happy path" (a real invite/program), so these specs assert the
 * not-found/graceful-degradation branch, which is real and reachable:
 *
 * - src/app/join/[token]/page.tsx: `.maybeSingle()` on the invitations table
 *   discards the query error and returns `data: null` when the request fails
 *   against the fake backend, so `!invite` is true and the page renders its
 *   own in-page "Invite not found" state (200, not the global 404 page).
 * - src/app/c/join/[programId]/page.tsx: `.single()` on programs similarly
 *   resolves to `data: null`, and the page calls `notFound()`, which renders
 *   the global custom not-found page (404).
 *
 * Verified manually (node fetch against a locally booted dev server with the
 * same fake env vars) before writing these assertions:
 *   GET /join/nonexistent-token-xyz            -> 200, h1 "Invite not found"
 *   GET /c/join/00000000-0000-0000-0000-000000000000 -> 404, "Page not found"
 */
test.describe("Public join/invite routes (no live DB)", () => {
  test("/join/<token> for a nonexistent token shows in-page 'Invite not found'", async ({
    page,
  }) => {
    const response = await page.goto("/join/nonexistent-token-xyz");
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: "Invitación no encontrada" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Este enlace de invitación no es válido o fue revocado. Pide a quien te invitó que te envíe uno nuevo.",
      ),
    ).toBeVisible();
  });

  test("/c/join/<programId> for a nonexistent program renders the global 404 page", async ({
    page,
  }) => {
    const response = await page.goto(
      "/c/join/00000000-0000-0000-0000-000000000000",
    );
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("heading", { name: "Página no encontrada" }),
    ).toBeVisible();
  });
});
