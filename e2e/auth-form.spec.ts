import { test, expect } from "@playwright/test";

/**
 * <AuthForm> (src/app/(auth)/auth-form.tsx) is shared by /login and /register.
 * These tests cover client-side HTML5 validation (required + type=email /
 * type=password) and the real (unmocked) network-failure degradation path:
 * with the fake Supabase env vars, any real submission attempt fails at the
 * network layer inside the signIn/signUp server action, and the action
 * surfaces that as `state.error`, rendered via role="alert". Verified
 * manually before writing this: submitting valid-looking credentials against
 * the fake backend produces an alert with the text "fetch failed" and the
 * page stays on the same URL — no crash, no navigation.
 */

for (const path of ["/login", "/register"] as const) {
  test.describe(`Client-side validation on ${path}`, () => {
    test("blocks submission when fields are empty", async ({ page }) => {
      await page.goto(path);
      const email = page.getByPlaceholder("you@business.com");
      const password = page.getByPlaceholder("••••••••");

      await expect(email).toHaveAttribute("required", "");
      await expect(email).toHaveAttribute("type", "email");
      await expect(password).toHaveAttribute("required", "");
      await expect(password).toHaveAttribute("type", "password");

      await page.locator('button[type="submit"]').click();

      // Native validation blocks the submit — we never leave the page.
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      const isValid = await email.evaluate(
        (el: HTMLInputElement) => el.validity.valid,
      );
      expect(isValid).toBe(false);
    });

    test("blocks submission when email is malformed", async ({ page }) => {
      await page.goto(path);
      const email = page.getByPlaceholder("you@business.com");
      const password = page.getByPlaceholder("••••••••");

      await email.fill("notanemail");
      await password.fill("somepassword123");
      await page.locator('button[type="submit"]').click();

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      const validity = await email.evaluate(
        (el: HTMLInputElement) => el.validity.typeMismatch,
      );
      expect(validity).toBe(true);
    });
  });
}

test.describe("Real submission against an unreachable Supabase backend", () => {
  test("login with valid-looking credentials surfaces a role=alert error, no crash", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@business.com").fill("test@example.com");
    await page.getByPlaceholder("••••••••").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    // The Next.js dev overlay also renders an empty role="alert" landmark, so
    // scope to one that actually has text (the AuthForm error paragraph).
    const alert = page.getByRole("alert").filter({ hasText: /\S/ });
    await expect(alert).toBeVisible();
    // Still on /login — the server action returned {error}, it did not throw
    // and crash the request, and there was no redirect.
    await expect(page).toHaveURL(/\/login$/);
  });

  test("register with valid-looking credentials surfaces a role=alert error, no crash", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByPlaceholder("you@business.com").fill("newuser@example.com");
    await page.getByPlaceholder("••••••••").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();

    const alert = page.getByRole("alert").filter({ hasText: /\S/ });
    await expect(alert).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });
});
