import { test, expect } from "@playwright/test";

test.describe("404 handling", () => {
  test("visiting a nonsense path renders the custom not-found page", async ({
    page,
  }) => {
    const response = await page.goto("/nonexistent-xyz");
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("heading", { name: "Página no encontrada" }),
    ).toBeVisible();
    await expect(
      page.getByText("Esta tarjeta o página no existe, o el enlace venció."),
    ).toBeVisible();

    const backHome = page.getByRole("link", { name: "Volver al inicio" });
    await expect(backHome).toHaveAttribute("href", "/");

    await backHome.click();
    await expect(page).toHaveURL(/\/$/);
  });
});
