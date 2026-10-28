/** Shared by the social/print format templates (the older three keep local copies). */

export interface TemplateProps {
  businessName: string;
  programName: string;
  rewardText: string;
  scanToJoinText: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  showBusinessName: boolean;
  qrDataUrl: string;
  previewLabel: string;
  logoAlt: string;
}

/** Export pixel sizes per template; the SVG viewBox matches these exactly. */
export const FORMAT_SIZES = {
  playful: { width: 1200, height: 1800 },
  elegant: { width: 1200, height: 1800 },
  retro: { width: 1200, height: 1800 },
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  a5: { width: 1480, height: 2100 },
} as const;

export type TemplateKey = keyof typeof FORMAT_SIZES;

export function templateFilename(
  programName: string,
  key: TemplateKey,
): string {
  const slug = programName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "card"}-${key}.png`;
}

/** Blend a #rrggbb color toward white (amount > 0) or black (amount < 0). */
export function tint(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  const target = amount >= 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  const mix = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + (target - c) * t)));
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function luminance(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or near-black, whichever reads on top of `hex`. */
export function contrastText(hex: string): string {
  return luminance(hex) > 0.6 ? "#151515" : "#ffffff";
}

/** Rough single-line shrink (no text measurement available); deterministic. */
export function fitFontSize(
  text: string,
  base: number,
  min: number,
  charsAtBase: number,
): number {
  if (text.length <= charsAtBase) return base;
  return Math.max(min, Math.round(base * (charsAtBase / text.length)));
}
