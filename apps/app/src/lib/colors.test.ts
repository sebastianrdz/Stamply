import { describe, expect, it } from "vitest";
import { hexToRgbString, readableForeground } from "./colors";

describe("hexToRgbString", () => {
  it("converts a hex color with #", () => {
    expect(hexToRgbString("#7c5cfc")).toBe("rgb(124, 92, 252)");
  });

  it("converts a hex color without a leading #", () => {
    expect(hexToRgbString("7c5cfc")).toBe("rgb(124, 92, 252)");
  });

  it("is case-insensitive", () => {
    expect(hexToRgbString("#7C5CFC")).toBe("rgb(124, 92, 252)");
  });

  it("returns the default fallback for invalid hex", () => {
    expect(hexToRgbString("not-a-color")).toBe("rgb(124, 92, 252)");
  });

  it("returns a custom fallback for invalid hex", () => {
    expect(hexToRgbString("nope", "rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
  });

  it("handles pure black and white", () => {
    expect(hexToRgbString("#000000")).toBe("rgb(0, 0, 0)");
    expect(hexToRgbString("#ffffff")).toBe("rgb(255, 255, 255)");
  });
});

describe("readableForeground", () => {
  it("picks dark text on a light background", () => {
    expect(readableForeground("#ffffff")).toBe("rgb(17, 19, 26)");
  });

  it("picks white text on a dark background", () => {
    expect(readableForeground("#000000")).toBe("rgb(255, 255, 255)");
  });

  it("falls back to white for invalid hex", () => {
    expect(readableForeground("nope")).toBe("rgb(255, 255, 255)");
  });

  it("uses white text just below the 0.6 luminance threshold", () => {
    // luminance = 0.299*r + 0.587*g + 0.114*b, normalized to 0-1.
    // #999999 -> (153*0.299+153*0.587+153*0.114)/255 = 153/255 = 0.6 exactly,
    // which the code requires to be STRICTLY greater than 0.6 to flip dark.
    expect(readableForeground("#999999")).toBe("rgb(255, 255, 255)");
  });

  it("uses dark text just above the 0.6 luminance threshold", () => {
    // #a0a0a0 -> luminance = 160/255 ≈ 0.627 > 0.6
    expect(readableForeground("#a0a0a0")).toBe("rgb(17, 19, 26)");
  });
});
