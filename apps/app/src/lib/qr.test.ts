import { describe, expect, it } from "vitest";
import { qrDataUrl } from "./qr";

describe("qrDataUrl", () => {
  it("resolves a data:image/png;base64, URL", async () => {
    const url = await qrDataUrl("stmp_abc123");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan(100);
  });

  it("respects a custom width option", async () => {
    const small = await qrDataUrl("stmp_abc123", { width: 100 });
    const big = await qrDataUrl("stmp_abc123", { width: 600 });
    // Larger width should produce more encoded PNG bytes, hence a longer data URL.
    expect(big.length).toBeGreaterThan(small.length);
  });

  it("respects custom dark/light color options", async () => {
    const defaultColors = await qrDataUrl("stmp_abc123");
    const customColors = await qrDataUrl("stmp_abc123", {
      dark: "#ff0000",
      light: "#00ff00",
    });
    expect(customColors).not.toBe(defaultColors);
  });

  it("produces different output for different input values", async () => {
    const a = await qrDataUrl("stmp_aaaaaaaaaaaa");
    const b = await qrDataUrl("stmp_bbbbbbbbbbbb");
    expect(a).not.toBe(b);
  });
});
