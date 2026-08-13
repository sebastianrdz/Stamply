import { test, expect } from "@playwright/test";

/**
 * Landing-page navigation (/ → /login, /register) now crosses the domain
 * boundary to the marketing site and is covered by apps/marketing's landing
 * spec (which asserts the absolute CTA hrefs). What remains here is the
 * app-internal cross-linking between the two auth pages.
 */
test.describe("Navigation between auth pages", () => {
  test("Create an account link on /login goes to /register", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Crea una cuenta" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole("heading", { name: "Comienza con Stamply" }),
    ).toBeVisible();
  });

  test("Sign in link on /register goes to /login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Bienvenido de nuevo" }),
    ).toBeVisible();
  });
});
