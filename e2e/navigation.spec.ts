import { test, expect } from "@playwright/test";

test.describe("Navigation between public pages", () => {
  test("Sign in (header) goes from / to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Bienvenido de nuevo" }),
    ).toBeVisible();
  });

  test("Get started (header) goes from / to /register", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Comenzar" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole("heading", { name: "Comienza con Stamply" }),
    ).toBeVisible();
  });

  test("Start free trial (hero) goes from / to /register", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Prueba gratis" }).first().click();
    await expect(page).toHaveURL(/\/register$/);
  });

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
