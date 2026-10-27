import { test, expect } from "@playwright/test";
import { PAID_PLANS, annualMonthly } from "@stamply/plans";
import esDict from "@stamply/i18n/dictionaries/es.json";
import enDict from "@stamply/i18n/dictionaries/en.json";
import { APP_URL } from "../playwright.config";

/**
 * Stamply defaults to Spanish for every visitor (no cookie). Copy is read from
 * the es/en dictionaries to stay in lockstep with the page. CTAs cross to the
 * app subdomain (NEXT_PUBLIC_APP_URL), so their hrefs are absolute.
 */
const L = esDict.landing;
const mxn = (n: number) => `$${n.toLocaleString("es-MX")}`;

test.describe("Landing page (/)", () => {
  test("renders a single h1, header CTAs and hero CTAs with correct hrefs", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: L.hero.title }),
    ).toBeVisible();

    const header = page.locator("header");
    await expect(
      header.getByRole("link", { name: L.nav.signIn }),
    ).toHaveAttribute("href", `${APP_URL}/login`);
    await expect(
      header.getByRole("link", { name: L.nav.getStarted }),
    ).toHaveAttribute("href", `${APP_URL}/register`);

    await expect(
      page.getByRole("main").getByRole("link", { name: L.hero.ctaPrimary }).first(),
    ).toHaveAttribute("href", `${APP_URL}/register`);
    await expect(
      page.getByRole("link", { name: L.hero.ctaSecondary }),
    ).toHaveAttribute("href", "#como-funciona");
  });

  test("header anchors point at the four sections", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("header").getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: L.nav.how })).toHaveAttribute("href", "/#como-funciona");
    await expect(nav.getByRole("link", { name: L.nav.examples })).toHaveAttribute("href", "/#ejemplos");
    await expect(nav.getByRole("link", { name: L.nav.pricing })).toHaveAttribute("href", "/#precios");
    await expect(nav.getByRole("link", { name: L.nav.types })).toHaveAttribute("href", "/#tipos-de-tarjeta");
    for (const id of ["como-funciona", "tipos-de-tarjeta", "ejemplos", "precios"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test("process visuals cycle automatically, with no buttons", async ({ page }) => {
    await page.goto("/");
    const how = page.locator("#como-funciona");
    await how.scrollIntoViewIfNeeded();
    await expect(how.getByRole("button")).toHaveCount(0);
    await expect(how.getByText(L.how.notes.enrollment)).toBeVisible();
    await expect(how.getByText(L.how.notes.update)).toBeVisible({ timeout: 10_000 });
    await expect(how.getByText(L.how.notes.proximity)).toBeVisible({ timeout: 10_000 });
  });

  test("examples cycle automatically, with no buttons", async ({ page }) => {
    await page.goto("/");
    const ex = page.locator("#ejemplos");
    const { bruma, alba, verde } = L.examples.businesses;
    await ex.scrollIntoViewIfNeeded();
    await expect(ex.getByRole("button")).toHaveCount(0);
    await expect(ex.getByRole("listitem")).toHaveCount(Object.keys(L.examples.businesses).length);
    await expect(ex.getByText(bruma.detail)).toBeVisible();
    await expect(ex.getByText(alba.detail)).toBeVisible({ timeout: 10_000 });
    await expect(ex.getByAltText(L.images.alba)).toBeVisible();
    await expect(ex.getByText(verde.detail)).toBeVisible({ timeout: 10_000 });
  });

  test("card types section lists the four types with their mock and industries", async ({ page }) => {
    await page.goto("/");
    const sec = page.locator("#tipos-de-tarjeta");
    await expect(sec.getByRole("heading", { level: 2, name: L.types.title })).toBeVisible();
    for (const c of Object.values(L.types.items)) {
      await expect(sec.getByRole("heading", { level: 3, name: c.name })).toBeVisible();
      await expect(sec.getByText(c.ideal)).toBeVisible();
    }
  });

  test("pricing: annual default shows MXN, monthly equivalent, annual total and IVA", async ({
    page,
  }) => {
    await page.goto("/");
    const pricing = page.locator("#precios");
    expect(PAID_PLANS).toHaveLength(3);

    for (const plan of PAID_PLANS) {
      const copy = esDict.billing.plans[plan.tier];
      await expect(
        pricing.getByRole("heading", { name: copy.name, exact: true }),
      ).toBeVisible();
      await expect(pricing.getByText(mxn(annualMonthly(plan.tier)!)).first()).toBeVisible();
      await expect(
        pricing.getByText(
          L.pricing.billedYear.replace("{total}", mxn(plan.annualTotal!)),
          { exact: false },
        ),
      ).toBeVisible();
    }
    await expect(pricing.getByText(L.pricing.taxIncluded).first()).toBeVisible();
    await expect(pricing.getByText(/más popular/i)).toHaveCount(0);

    const ctas = pricing.getByRole("link", { name: L.pricing.cta });
    await expect(ctas).toHaveCount(PAID_PLANS.length);
    for (const link of await ctas.all()) {
      await expect(link).toHaveAttribute("href", `${APP_URL}/register`);
    }
  });

  test("pricing: toggling to Monthly shows monthly prices", async ({ page }) => {
    await page.goto("/");
    const pricing = page.locator("#precios");
    await pricing.getByRole("button", { name: esDict.common.monthly }).click();
    for (const plan of PAID_PLANS) {
      await expect(pricing.getByText(mxn(plan.price)).first()).toBeVisible();
    }
    await expect(pricing.getByText(L.pricing.billedMonth).first()).toBeVisible();
  });

  test("FAQ starts closed and only one item is open at a time", async ({ page }) => {
    await page.goto("/");
    const btns = page.locator("#faq button[aria-expanded]");
    await expect(btns).toHaveCount(L.faq.items.length);
    await expect(page.locator("#faq button[aria-expanded=true]")).toHaveCount(0);
    await btns.nth(0).click();
    await expect(page.getByText(L.faq.items[0].a)).toBeVisible();
    await btns.nth(1).click();
    await expect(page.getByText(L.faq.items[1].a)).toBeVisible();
    await expect(page.getByText(L.faq.items[0].a)).toBeHidden();
    await expect(page.locator("#faq button[aria-expanded=true]")).toHaveCount(1);
    await btns.nth(1).click();
    await expect(page.locator("#faq button[aria-expanded=true]")).toHaveCount(0);
  });

  test("mobile menu toggles, closes on Escape and returns focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: L.nav.openMenu });
    await toggle.click();
    await expect(page.locator("#mobile-menu")).toBeVisible();
    await expect(
      page.getByRole("button", { name: L.nav.closeMenu }),
    ).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-menu")).toHaveCount(0);
    await expect(page.getByRole("button", { name: L.nav.openMenu })).toBeFocused();

    await toggle.click();
    await page.locator("#mobile-menu").getByRole("link", { name: L.nav.pricing }).click();
    await expect(page.locator("#mobile-menu")).toHaveCount(0);
  });

  test("no horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
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
      .first()
      .getByRole("button", { name: "English" })
      .click();

    const h1 = page.getByRole("heading", { level: 1, name: enDict.landing.hero.title });
    await expect(h1).toBeVisible();
    await page.reload();
    await expect(h1).toBeVisible();
  });
});
