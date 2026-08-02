import { test, expect } from "@playwright/test";

test.describe("404 handling", () => {
  test("visiting a nonsense path renders the custom not-found page", async ({
    page,
  }) => {
    const response = await page.goto("/nonexistent-xyz");
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "This card or page doesn't exist, or the link has expired.",
      ),
    ).toBeVisible();

    const backHome = page.getByRole("link", { name: "Back home" });
    await expect(backHome).toHaveAttribute("href", "/");

    await backHome.click();
    await expect(page).toHaveURL(/\/$/);
  });
});
