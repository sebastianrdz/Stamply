import { test, expect } from "@playwright/test";

/**
 * proxy.ts guards /dashboard/**. With the fake Supabase env vars,
 * supabase.auth.getUser() fails closed (no session), so every dashboard
 * route redirects to /login?next=<original path>, verified as ground truth
 * via 307 status + Location header before writing these specs.
 */
test.describe("Auth-gated redirects (unauthenticated)", () => {
  test("/dashboard redirects to /login?next=%2Fdashboard", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("http://localhost:3100/login?next=%2Fdashboard");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });

  test("/dashboard/billing redirects to /login?next=%2Fdashboard%2Fbilling", async ({
    page,
  }) => {
    await page.goto("/dashboard/billing");
    await expect(page).toHaveURL(
      "http://localhost:3100/login?next=%2Fdashboard%2Fbilling",
    );
  });

  test("redirect happens at the HTTP layer (307), not client-side", async ({
    request,
  }) => {
    const res = await request.get("/dashboard", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toBe("/login?next=%2Fdashboard");
  });
});
