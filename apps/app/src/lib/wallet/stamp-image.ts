import "server-only";

import { Resvg } from "@resvg/resvg-js";
import { imageBuffer } from "@/lib/wallet/apple/assets";
import { computeStampGrid, type StampGridLayout } from "./stamp-layout";

/**
 * Renders the "stamp strip" visual shared by Apple and Google wallet passes:
 * the business background (or brand color) with a dark shade, and a grid of
 * up to 10 stamp slots (<=2 rows) showing progress. Points-type programs
 * should NOT call this — callers gate on `program.type === "stamp"`.
 */
export interface StampImageInput {
  progress: number;
  goal: number;
  brandHex: string;
  stampIconUrl: string | null;
  backgroundImageUrl: string | null;
  /** Target output width in px; height is derived from a fixed aspect ratio. */
  width: number;
}

// Apple's storeCard strip is nominally 375x123pt, but at that ratio two rows
// of slots are height-constrained (diameter capped well below what the width
// could fit), making the grid look small. Use a taller ~2:1 ratio instead —
// Apple accepts any strip image (it's scaled to fit), and Google's hero has
// slack for it too — so slot size is governed by width, not a cramped height.
const ASPECT_RATIO = 375 / 185;

export const FALLBACK_BG = "#7c5cfc";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/**
 * Normalize a caller-supplied hex color before it's interpolated into the SVG
 * string. `brandHex` is currently only ever written via a zod
 * `^#[0-9a-fA-F]{6}$` regex (src/lib/businesses/settings-actions.ts), so this
 * isn't live-exploitable today — but the renderer must defend itself rather
 * than trust upstream validation: an unescaped, malformed value (e.g. one
 * containing a `"` or `<`) landing raw in an SVG attribute can break Resvg
 * parsing or inject SVG structure.
 */
function sanitizeHex(hex: string): string {
  return HEX_COLOR_RE.test(hex) ? hex : FALLBACK_BG;
}

export async function renderStampStrip(input: StampImageInput): Promise<Buffer> {
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(width / ASPECT_RATIO));

  const [bgBuf, iconBuf] = await Promise.all([
    imageBuffer(input.backgroundImageUrl),
    imageBuffer(input.stampIconUrl),
  ]);

  const grid = computeStampGrid(input.progress, input.goal);
  const svg = buildStampSvg({
    width,
    height,
    brandHex: input.brandHex,
    bgBuf,
    iconBuf,
    grid,
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return Buffer.from(resvg.render().asPng());
}

/** Sniff enough of an image buffer to build a correct data: URI mime type. */
function sniffMime(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (buf.length >= 6 && buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  // Business "stamp" assets are only ever uploaded as SVG; anything else
  // unrecognized falls back to SVG since it's the only text-based type we serve.
  return "image/svg+xml";
}

function dataUri(buf: Buffer): string {
  return `data:${sniffMime(buf)};base64,${buf.toString("base64")}`;
}

/**
 * Pure SVG string builder — takes already-fetched image buffers so it can be
 * unit-tested without network access or the native rasterizer.
 */
export function buildStampSvg(params: {
  width: number;
  height: number;
  brandHex: string;
  bgBuf: Buffer | null;
  iconBuf: Buffer | null;
  grid: StampGridLayout;
}): string {
  const { width: W, height: H, brandHex, bgBuf, iconBuf, grid } = params;

  const background = bgBuf
    ? `<image href="${dataUri(bgBuf)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" />`
    : `<rect x="0" y="0" width="${W}" height="${H}" fill="${sanitizeHex(brandHex)}" />`;

  // ~40% black shade so the grid stays legible over any background.
  const shade = `<rect x="0" y="0" width="${W}" height="${H}" fill="#000000" opacity="0.4" />`;

  const grid_ = buildGrid({ W, H, iconBuf, grid });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${background}${shade}${grid_}</svg>`;
}

function buildGrid(params: {
  W: number;
  H: number;
  iconBuf: Buffer | null;
  grid: StampGridLayout;
}): string {
  const { W, H, iconBuf, grid } = params;
  const rows = grid.rows;
  const rowCount = rows.length;
  const maxRowLen = Math.max(...rows.map((r) => r.length));

  // Apple renders storeCard header fields over the top-right corner of the
  // strip, so bias the grid downward with a bit of top clearance (see
  // buildApplePass, which also drops the primary field for stamp programs to
  // avoid its centered overlay text colliding with the grid). With the taller
  // ~2:1 strip (see ASPECT_RATIO) there's enough height that these paddings
  // no longer need to be the limiting dimension — slot size is governed by
  // width instead, so slots read roughly 2x bigger than the original 375x123
  // ratio produced.
  const padTop = H * 0.14;
  const padBottom = H * 0.14;
  const availH = H - padTop - padBottom;
  const rowGap = rowCount === 2 ? availH * 0.04 : 0;
  const rowHeight = rowCount === 2 ? (availH - rowGap) / 2 : availH;

  const padX = W * 0.07;
  const availW = W - padX * 2;
  const gapFactor = 0.16; // gap between slot centers, as a fraction of diameter
  const diameterByWidth =
    availW / (maxRowLen + (maxRowLen - 1) * gapFactor);
  const diameterByHeight = rowHeight * 0.92;
  const d = Math.min(diameterByWidth, diameterByHeight);

  const parts: string[] = [];
  rows.forEach((row, rowIndex) => {
    const rowWidth = row.length * d + (row.length - 1) * gapFactor * d;
    const startX = (W - rowWidth) / 2 + d / 2;
    const cy =
      rowCount === 2
        ? padTop + rowIndex * (rowHeight + rowGap) + rowHeight / 2
        : padTop + availH / 2;

    row.forEach((slot, i) => {
      const cx = startX + i * (d + gapFactor * d);
      parts.push(renderSlot({ cx, cy, d, filled: slot.filled, iconBuf }));
    });
  });

  return parts.join("");
}

function renderSlot(params: {
  cx: number;
  cy: number;
  d: number;
  filled: boolean;
  iconBuf: Buffer | null;
}): string {
  const { cx, cy, d, filled, iconBuf } = params;

  if (iconBuf) {
    const opacity = filled ? 1.0 : 0.25;
    const half = d / 2;
    return `<image href="${dataUri(iconBuf)}" x="${cx - half}" y="${cy - half}" width="${d}" height="${d}" opacity="${opacity}" />`;
  }

  // Shape fallback when the business has no uploaded stamp icon.
  if (filled) {
    return `<circle cx="${cx}" cy="${cy}" r="${d / 2}" fill="#ffffff" opacity="0.95" />`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${d / 2 - 1.5}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.35" />`;
}
