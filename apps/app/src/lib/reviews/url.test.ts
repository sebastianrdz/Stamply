import { describe, expect, it } from "vitest";
import { isReviewUrl, reviewLink } from "./url";

describe("isReviewUrl", () => {
  it.each([
    "https://g.page/r/abc/review",
    "https://www.google.com/maps/place/x",
    "https://search.google.com/local/writereview?placeid=ChIJ",
    "https://maps.app.goo.gl/AbC123",
    "https://goo.gl/maps/x",
    "https://g.co/kgs/x",
    "https://share.google/abc",
  ])("accepts %s", (u) => expect(isReviewUrl(u)).toBe(true));

  it.each([
    "http://g.page/r/abc/review",
    "javascript:alert(1)",
    "https://google.com.evil.io/x",
    "https://evilgoogle.com/x",
    "https://evil.io/?u=https://google.com",
    "https://user:pw@google.com/x",
    "not a url",
    "",
  ])("rejects %s", (u) => expect(isReviewUrl(u)).toBe(false));
});

describe("reviewLink", () => {
  it("builds the tracked path, optionally tagging the card page", () => {
    expect(reviewLink("tok")).toMatch(/\/r\/tok$/);
    expect(reviewLink("tok", "card")).toMatch(/\/r\/tok\?s=card$/);
  });
});
