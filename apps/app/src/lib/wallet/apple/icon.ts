import "server-only";

import { Resvg } from "@resvg/resvg-js";
import { imageBuffer, placeholderIcon } from "./assets";
import { dataUri } from "@/lib/wallet/image-data";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const FALLBACK_BG = "#7c5cfc";

function sanitizeHex(hex: string): string {
  return HEX_COLOR_RE.test(hex) ? hex : FALLBACK_BG;
}

// Apple's pass icon is nominally 29pt → 29/58/87px at 1x/2x/3x. This icon is
// what shows on the lock screen (geo relevance) and in notifications, not the
// pass-face logo.
const ICON_SIZES: ReadonlyArray<readonly [name: string, size: number]> = [
  ["icon.png", 29],
  ["icon@2x.png", 58],
  ["icon@3x.png", 87],
];

/**
 * Pure SVG builder for the square pass icon. Takes an already-fetched logo
 * buffer so it's unit-testable without network or the rasterizer (mirrors
 * `buildStampSvg`).
 *
 * The background is always the **brand primary color**; the logo is contain-fit
 * on top (`xMidYMid meet`, no distortion) inset by ~10% when present, otherwise
 * it's a solid brand-color square. We emit a full square; Apple applies its own
 * rounded-corner mask.
 */
export function buildIconSvg(params: {
  logoBuf: Buffer | null;
  brandHex: string;
  size: number;
}): string {
  const { logoBuf, brandHex, size: S } = params;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">`;
  const bg = `<rect width="${S}" height="${S}" fill="${sanitizeHex(brandHex)}" />`;

  if (!logoBuf) {
    return `${open}${bg}</svg>`;
  }

  const pad = Math.round(S * 0.1);
  const inner = S - pad * 2;
  return `${open}${bg}<image href="${dataUri(logoBuf)}" x="${pad}" y="${pad}" width="${inner}" height="${inner}" preserveAspectRatio="xMidYMid meet" /></svg>`;
}

/**
 * Render the pass icon set (icon.png / @2x / @3x) from the business logo.
 *
 * Never throws — the passes web-service route (auto-updates) has no try/catch
 * of its own, so a bad or unreachable logo must degrade to the placeholder
 * rather than break pass generation. Same contract as `buildStampStripSet`.
 */
export async function renderPassIconSet(
  logoUrl: string | null,
  brandHex: string,
): Promise<Record<string, Buffer>> {
  try {
    const logoBuf = await imageBuffer(logoUrl);
    const out: Record<string, Buffer> = {};
    for (const [name, size] of ICON_SIZES) {
      const svg = buildIconSvg({ logoBuf, brandHex, size });
      out[name] = Buffer.from(
        new Resvg(svg, { fitTo: { mode: "width", value: size } })
          .render()
          .asPng(),
      );
    }
    return out;
  } catch (e) {
    console.error("[apple wallet] pass icon render failed", e);
    const icon = placeholderIcon();
    return {
      "icon.png": icon,
      "icon@2x.png": icon,
      "icon@3x.png": icon,
    };
  }
}
