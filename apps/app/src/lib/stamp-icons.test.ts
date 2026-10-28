// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { STAMP_ICONS, svgFileFrom } from "./stamp-icons";

describe("stamp icons", () => {
  it("has unique, renderable icons", () => {
    expect(new Set(STAMP_ICONS.map((i) => i.name)).size).toBe(
      STAMP_ICONS.length,
    );
    expect(STAMP_ICONS.every((i) => i.Icon)).toBe(true);
  });

  it("serializes an inline svg into a standalone svg file", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 256 256");
    svg.innerHTML = '<path d="M0 0h10v10z" fill="#fff"/>';
    const file = svgFileFrom(svg, "coffee");
    expect(file.name).toBe("coffee.svg");
    expect(file.type).toBe("image/svg+xml");
    // jsdom's File has no .text().
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(file);
    });
    expect(text).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(text).toContain('width="256"');
    expect(text).toContain("<path");
  });
});
