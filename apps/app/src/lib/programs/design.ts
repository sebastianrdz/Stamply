/** Per-card visual design, stored in `programs.design` (jsonb). */
export type CardDesign = {
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  background_image_url: string | null;
  stamp_icon_url: string | null;
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

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHex = (v: unknown): v is string =>
  typeof v === "string" && HEX.test(v);

/**
 * Parse `program.design` into a typed object. Any missing/invalid key falls back
 * to the business's old value (an explicit `null` image means "none").
 */
export function cardDesign(
  program: { design?: Record<string, unknown> | null },
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
    show_business_name:
      typeof d.show_business_name === "boolean"
        ? d.show_business_name
        : business.show_business_name,
  };
}
