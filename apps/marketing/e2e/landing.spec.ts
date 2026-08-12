import { test, expect } from "@playwright/test";
import { PAID_PLANS } from "@stamply/plans";
import esDict from "@stamply/i18n/dictionaries/es.json";
import { APP_URL } from "../playwright.config";

/**
 * Stamply defaults to Spanish for every visitor (no cookie) — see
 * @stamply/i18n config. These assertions target that default, not English,
 * since a fresh visit to "/" is exactly the case the default-locale
 * requirement covers. Plan display copy (name/tagline/features) comes from the
 * es.json dictionary rather than PAID_PLANS itself, so it's read directly from
 * the dictionary to stay in lockstep with the page.
 *
 * Sign-in / register / plan CTAs now cross the domain boundary to the app
 * subdomain (NEXT_PUBLIC_APP_URL), so their hrefs are absolute.
 */
test.describe("Landing page (/)", () => {
  test("renders hero heading and primary CTAs with correct hrefs", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: esDict.landing.hero.title,
      }),
    ).toBeVisible();

    // Header nav — absolute links to the app subdomain
    await expect(
      page.getByRole("link", { name: esDict.landing.nav.signIn }),
    ).toHaveAttribute("href", `${APP_URL}/login`);
    await expect(
      page.getByRole("link", { name: esDict.landing.nav.getStarted }),
    ).toHaveAttribute("href", `${APP_URL}/register`);

    // Hero CTA
    await expect(
      page.getByRole("link", { name: esDict.landing.hero.ctaPrimary }).first(),
    ).toHaveAttribute("href", `${APP_URL}/register`);
  });

  test("pricing section renders all 3 paid plans with prices sourced from PAID_PLANS", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#pricing").scrollIntoViewIfNeeded();

    // Regression guard: PAID_PLANS must contain exactly the 3 tiers the
    // landing page assumes. If this fails, plans changed shape and the
    // page-content assertions below need to be revisited too.
    expect(PAID_PLANS).toHaveLength(3);

    const pricing = page.locator("#pricing");

    for (const plan of PAID_PLANS) {
      const planCopy = esDict.billing.plans[plan.tier];
      await expect(
        pricing.getByRole("heading", { name: planCopy.name, exact: true }),
      ).toBeVisible();
      await expect(
        pricing.getByText(`$${plan.price}`, { exact: false }),
      ).toBeVisible();
    }

    // Every paid-plan CTA points at the app's register page.
    const registerLinksInPricing = pricing.getByRole("link", {
      name: esDict.landing.pricing.cta,
    });
    await expect(registerLinksInPricing).toHaveCount(PAID_PLANS.length);
    for (const link of await registerLinksInPricing.all()) {
      await expect(link).toHaveAttribute("href", `${APP_URL}/register`);
    }
  });

  test("footer renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/derechos reservados/)).toBeVisible();
  });

  test("language selector switches the page to English and persists it", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("group", { name: esDict.settings.language.title })
      .getByRole("button", { name: "English" })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "Turn one-time visitors into regulars.",
      }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Turn one-time visitors into regulars.",
      }),
    ).toBeVisible();
  });
});
