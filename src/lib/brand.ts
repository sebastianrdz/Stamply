import type { CSSProperties } from "react";

/** Convert a #rrggbb hex color to an "H S% L%" triplet for CSS custom props. */
export function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Near-black or white HSL triplet for text sitting on a brand-colored
 * surface. Same luminance threshold/formula as `readableForeground` in
 * `src/lib/colors.ts` (kept inline here rather than imported since that
 * helper returns an `rgb(...)` string, not an "H S% L%" triplet).
 */
function foregroundTripletFor(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return "0 0% 100%";
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "222 18% 9%" : "0 0% 100%";
}

/** Inline style that themes a subtree with a business's brand color. */
export function brandStyle(business: {
  brand_primary_color: string;
}): CSSProperties {
  const triplet = hexToHslTriplet(business.brand_primary_color);
  if (!triplet) return {};
  return {
    ["--brand" as string]: triplet,
    ["--brand-foreground" as string]: foregroundTripletFor(
      business.brand_primary_color,
    ),
  } as CSSProperties;
}
