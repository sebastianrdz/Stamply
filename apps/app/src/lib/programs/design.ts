/** Per-card visual design, stored in `programs.design` (jsonb). */
export type CardDesign = {
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  background_image_url: string | null;
  stamp_icon_url: string | null;
  /** Tints every stamp icon (silhouette) with this color; null = icons keep their own colors. */
  stamp_color: string | null;
  /** Black overlay on top of the background image, 0 (none) to 1. Default 0.4. */
  overlay_opacity: number;
  show_business_name: boolean;
};

/** The business's legacy branding columns: fallback while a design key is missing. */
export interface BusinessBrand {
  brand_primary_color: string;
  brand_secondary_color: string;
  logo_url: string | null;
  background_image_url: string | null;
  stamp_icon_url?: string | null;
  show_business_name: boolean;
}

export const DEFAULT_OVERLAY_OPACITY = 0.4;

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHex = (v: unknown): v is string =>
  typeof v === "string" && HEX.test(v);

/**
 * Parse `program.design` into a typed object. Any missing/invalid key falls back
 * to the business's old value (an explicit `null` image means "none").
 */
export function cardDesign(
  program: { design?: Record<string, unknown> | null; type?: string },
  business: BusinessBrand,
): CardDesign {
  const d = program.design ?? {};
  const url = (key: string, fallback: string | null | undefined) =>
    key in d && (d[key] === null || typeof d[key] === "string")
      ? (d[key] as string | null)
      : (fallback ?? null);
  return {
    primary_color: isHex(d.primary_color)
      ? d.primary_color
      : business.brand_primary_color,
    secondary_color: isHex(d.secondary_color)
      ? d.secondary_color
      : business.brand_secondary_color,
    logo_url: url("logo_url", business.logo_url),
    background_image_url: url(
      "background_image_url",
      business.background_image_url,
    ),
    stamp_icon_url: url("stamp_icon_url", business.stamp_icon_url),
    stamp_color: isHex(d.stamp_color) ? d.stamp_color : null,
    overlay_opacity:
      typeof d.overlay_opacity === "number" &&
      d.overlay_opacity >= 0 &&
      d.overlay_opacity <= 1
        ? d.overlay_opacity
        : // Stamp cards always had a 40% shade; other types showed the image as is.
          program.type && program.type !== "stamp"
          ? 0
          : DEFAULT_OVERLAY_OPACITY,
    show_business_name:
      typeof d.show_business_name === "boolean"
        ? d.show_business_name
        : business.show_business_name,
  };
}
