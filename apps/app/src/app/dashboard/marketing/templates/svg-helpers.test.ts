import { describe, expect, it } from "vitest";
import {
  FORMAT_SIZES,
  contrastText,
  fitFontSize,
  templateFilename,
  tint,
} from "./svg-helpers";

describe("svg-helpers", () => {
  it("has the requested social/print dimensions", () => {
    expect(FORMAT_SIZES.story).toEqual({ width: 1080, height: 1920 });
    expect(FORMAT_SIZES.square).toEqual({ width: 1080, height: 1080 });
    expect(FORMAT_SIZES.a5).toEqual({ width: 1480, height: 2100 });
  });

  it("builds a safe filename", () => {
    expect(templateFilename("Café Loyalty!", "story")).toBe(
      "caf-loyalty-story.png",
    );
    expect(templateFilename("***", "a5")).toBe("card-a5.png");
  });

  it("tints and picks contrast text", () => {
    expect(tint("#000000", 1)).toBe("#ffffff");
    expect(tint("bad", 0.5)).toBe("bad");
    expect(contrastText("#ffffff")).toBe("#151515");
    expect(contrastText("#102030")).toBe("#ffffff");
  });

  it("shrinks long text but not below min", () => {
    expect(fitFontSize("abc", 80, 40, 10)).toBe(80);
    expect(fitFontSize("a".repeat(20), 80, 40, 10)).toBe(40);
    expect(fitFontSize("a".repeat(100), 80, 40, 10)).toBe(40);
  });
});
