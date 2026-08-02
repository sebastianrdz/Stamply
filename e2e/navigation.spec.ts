import { test, expect } from "@playwright/test";

test.describe("Navigation between public pages", () => {
  test("Sign in (header) goes from / to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });

  test("Get started (header) goes from / to /register", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole("heading", { name: "Start with Stamply" }),
    ).toBeVisible();
  });

  test("Start free trial (hero) goes from / to /register", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Start free trial" }).first().click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("Create an account link on /login goes to /register", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole("heading", { name: "Start with Stamply" }),
    ).toBeVisible();
  });

  test("Sign in link on /register goes to /login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });
});
