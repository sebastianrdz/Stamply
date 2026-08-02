import { test, expect } from "@playwright/test";
import { PAID_PLANS } from "@/lib/billing/plans";

test.describe("Landing page (/)", () => {
  test("renders hero heading and primary CTAs with correct hrefs", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Turn one-time visitors into regulars." }),
    ).toBeVisible();

    // Header nav
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    await expect(
      page.getByRole("link", { name: "Get started" }),
    ).toHaveAttribute("href", "/register");

    // Hero CTA
    await expect(
      page.getByRole("link", { name: "Start free trial" }).first(),
    ).toHaveAttribute("href", "/register");
  });

  test("pricing section renders all 3 paid plans with prices sourced from PAID_PLANS", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#pricing").scrollIntoViewIfNeeded();

    // Regression guard: PAID_PLANS must contain exactly the 3 tiers the
    // landing page assumes. If this fails, plans.ts changed shape and the
    // page-content assertions below need to be revisited too.
    expect(PAID_PLANS).toHaveLength(3);

    const pricing = page.locator("#pricing");

    for (const plan of PAID_PLANS) {
      await expect(
        pricing.getByRole("heading", { name: plan.name, exact: true }),
      ).toBeVisible();
      await expect(pricing.getByText(`$${plan.price}`, { exact: false })).toBeVisible();
    }

    // Every paid-plan CTA points at /register.
    const registerLinksInPricing = pricing.getByRole("link", {
      name: "Start free trial",
    });
    await expect(registerLinksInPricing).toHaveCount(PAID_PLANS.length);
    for (const link of await registerLinksInPricing.all()) {
      await expect(link).toHaveAttribute("href", "/register");
    }
  });

  test("footer renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/All rights reserved/)).toBeVisible();
  });
});
