import { describe, expect, it } from "vitest";
import { cardDesign } from "./design";

const biz = {
  brand_primary_color: "#111111",
  brand_secondary_color: "#222222",
  logo_url: "https://x/logo.png",
  background_image_url: null,
  show_business_name: true,
};

describe("cardDesign", () => {
  it("falls back to the business for an empty design", () => {
    expect(cardDesign({ design: {} }, biz)).toEqual({
      primary_color: "#111111",
      secondary_color: "#222222",
      logo_url: "https://x/logo.png",
      background_image_url: null,
      stamp_icon_url: null,
      show_business_name: true,
    });
  });
  it("prefers design keys, treats explicit null as none, ignores junk", () => {
    const d = cardDesign(
      {
        design: {
          primary_color: "#abcdef",
          secondary_color: "red",
          logo_url: null,
          show_business_name: false,
        },
      },
      biz,
    );
    expect(d.primary_color).toBe("#abcdef");
    expect(d.secondary_color).toBe("#222222");
    expect(d.logo_url).toBeNull();
    expect(d.show_business_name).toBe(false);
  });
});
