import { createElement, isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { interpolate, interpolateNodes } from "./format";

describe("interpolate", () => {
  it("substitutes a single token with its value", () => {
    expect(interpolate("Hello {name}", { name: "World" })).toBe(
      "Hello World",
    );
  });

  it("leaves a token missing from vars as literal text", () => {
    expect(interpolate("Hello {name}", {})).toBe("Hello {name}");
  });

  it("substitutes multiple distinct tokens in one template", () => {
    expect(interpolate("{count} opted in on {day}", { count: 3, day: "Monday" })).toBe(
      "3 opted in on Monday",
    );
  });
});

describe("interpolateNodes", () => {
  it("returns the plain text unchanged when the template has no tokens", () => {
    const result = interpolateNodes("hello world", {});
    expect(result).toEqual(["hello world"]);
  });

  it("leaves a token missing from vars as the literal {token} string, not blank", () => {
    const result = interpolateNodes("Hi {name}!", {});
    expect(result).toEqual(["Hi ", "{name}", "!"]);
  });

  it("gives two occurrences of the same token distinct keys and independent elements", () => {
    const link = createElement("a", { href: "/x" }, "here");
    const result = interpolateNodes("{link} and {link}", { link });

    // Template splits into ["", "{link}", " and ", "{link}", ""] — the two
    // substituted elements land at indices 1 and 3.
    expect(isValidElement(result[1])).toBe(true);
    expect(isValidElement(result[3])).toBe(true);
    expect(result[1]).not.toBe(result[3]);

    const first = result[1] as ReactElement;
    const second = result[3] as ReactElement;

    // Same underlying element (type/props preserved by cloneElement)...
    expect(first.type).toBe("a");
    expect(second.type).toBe("a");
    expect(first.props).toEqual(second.props);

    // ...but distinct, non-empty keys so React never warns about duplicates.
    expect(first.key).toBeTruthy();
    expect(second.key).toBeTruthy();
    expect(first.key).not.toBe(second.key);
  });

  it("interleaves two different tokens substituted with elements in order", () => {
    const name = createElement("b", null, "Bob");
    const link = createElement("a", { href: "#" }, "here");

    const result = interpolateNodes("Hello {name}, click {link} now", {
      name,
      link,
    });

    expect(result).toHaveLength(5);
    expect(result[0]).toBe("Hello ");
    expect(isValidElement(result[1])).toBe(true);
    expect((result[1] as ReactElement).type).toBe("b");
    expect((result[1] as ReactElement).props).toMatchObject({
      children: "Bob",
    });
    expect(result[2]).toBe(", click ");
    expect(isValidElement(result[3])).toBe(true);
    expect((result[3] as ReactElement).type).toBe("a");
    expect((result[3] as ReactElement).props).toMatchObject({
      href: "#",
      children: "here",
    });
    expect(result[4]).toBe(" now");
  });
});
