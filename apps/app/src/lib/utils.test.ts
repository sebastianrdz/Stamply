import { describe, expect, it } from "vitest";
import { cn } from "@stamply/ui/utils";

describe("cn", () => {
  it("merges plain class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("resolves conflicting Tailwind utility classes, keeping the last one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, 0, "b")).toBe("a b");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("supports arrays of class values", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("returns an empty string for no meaningful input", () => {
    expect(cn(false, undefined, null)).toBe("");
  });
});
