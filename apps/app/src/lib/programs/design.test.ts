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
      stamp_color: null,
      overlay_opacity: 0.4,
      show_business_name: true,
    });
  });
  it("defaults the overlay by type: 40% for stamp, none for other types, saved value wins", () => {
    expect(cardDesign({ type: "stamp", design: {} }, biz).overlay_opacity).toBe(0.4);
    expect(cardDesign({ type: "coupon", design: {} }, biz).overlay_opacity).toBe(0);
    expect(
      cardDesign({ type: "coupon", design: { overlay_opacity: 0.6 } }, biz).overlay_opacity,
    ).toBe(0.6);
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
