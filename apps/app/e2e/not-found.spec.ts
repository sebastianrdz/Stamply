import { test, expect } from "@playwright/test";
import { MARKETING_URL } from "../playwright.config";

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

    // "Back home" now leaves the app subdomain for the marketing apex, so we
    // assert the cross-domain href rather than following it (the marketing app
    // isn't booted in this suite).
    const backHome = page.getByRole("link", { name: "Volver al inicio" });
    await expect(backHome).toHaveAttribute("href", MARKETING_URL);
  });
});
