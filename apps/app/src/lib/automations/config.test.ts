import { describe, expect, it } from "vitest";
import { renderMessage } from "./config";

const LINK = "https://app.example.com/r/" + "t".repeat(40);

describe("renderMessage with {link}", () => {
  it("keeps the whole link by trimming the text before it", () => {
    const business = "B".repeat(80);
    const template = "x".repeat(100) + " {business} {name} {link}";
    const out = renderMessage(template, { business, name: "Ana", link: LINK });
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith(LINK)).toBe(true);
  });

  it("renders a short message untouched", () => {
    expect(
      renderMessage("Thanks, {name}! {link}", { name: "Ana", link: LINK }),
    ).toBe(`Thanks, Ana! ${LINK}`);
  });

  it("still truncates ordinary templates at 200", () => {
    expect(renderMessage("y".repeat(300), {})).toHaveLength(200);
  });
});
