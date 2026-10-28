import "server-only";

import { Resvg } from "@resvg/resvg-js";
import { imageBuffer } from "@/lib/wallet/apple/assets";
import { dataUri } from "@/lib/wallet/image-data";
import {
  computeStampGrid,
  type StampGridLayout,
} from "@stamply/ui/stamp-layout";

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
  /** Icon per 1-based stamp number (milestones, final reward); falls back to `stampIconUrl`. */
  slotIconUrls?: Record<number, string>;
  /** Tints every icon (silhouette) with this color; null = icons keep their own colors. */
  iconColor?: string | null;
  /** Per 1-based stamp number; overrides `iconColor` for that slot. */
  slotColors?: Record<number, string>;
  /** Black overlay on the background, 0..1 (default 0.4). */
  overlayOpacity?: number;
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

/** One filter per distinct color (ids cannot contain the hash). */
const tintId = (hex: string) => `tint-${hex.slice(1)}`;

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

/**
 * Background image under a black overlay, for non-stamp cards (no stamp grid).
 * Null when there is no (fetchable) background: callers then send nothing.
 */
export async function renderOverlayStrip(input: {
  backgroundImageUrl: string | null;
  overlayOpacity: number;
  width: number;
}): Promise<Buffer | null> {
  const bg = await imageBuffer(input.backgroundImageUrl);
  if (!bg) return null;
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(width / ASPECT_RATIO));
  const opacity = Math.min(1, Math.max(0, input.overlayOpacity));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<image href="${dataUri(bg)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#000000" opacity="${opacity}" /></svg>`;
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng(),
  );
}

export async function renderStampStrip(
  input: StampImageInput,
): Promise<Buffer> {
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(width / ASPECT_RATIO));

  const slotUrls = Object.entries(input.slotIconUrls ?? {});
  const [bgBuf, iconBuf, ...slotBufs] = await Promise.all([
    imageBuffer(input.backgroundImageUrl),
    imageBuffer(input.stampIconUrl),
    ...slotUrls.map(([, url]) => imageBuffer(url)),
  ]);
  const slotIconBufs: Record<number, Buffer> = {};
  slotUrls.forEach(([at], i) => {
    const buf = slotBufs[i];
    if (buf) slotIconBufs[Number(at)] = buf;
  });

  const grid = computeStampGrid(input.progress, input.goal);
  const svg = buildStampSvg({
    width,
    height,
    brandHex: input.brandHex,
    bgBuf,
    iconBuf,
    slotIconBufs,
    iconColor: input.iconColor,
    slotColors: input.slotColors,
    overlayOpacity: input.overlayOpacity,
    grid,
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return Buffer.from(resvg.render().asPng());
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
  slotIconBufs?: Record<number, Buffer>;
  iconColor?: string | null;
  slotColors?: Record<number, string>;
  overlayOpacity?: number;
  grid: StampGridLayout;
}): string {
  const {
    width: W,
    height: H,
    brandHex,
    bgBuf,
    iconBuf,
    slotIconBufs,
    grid,
  } = params;
  const tint = params.iconColor ? sanitizeHex(params.iconColor) : null;
  const slotTints: Record<number, string> = {};
  for (const [slot, c] of Object.entries(params.slotColors ?? {}))
    slotTints[Number(slot)] = sanitizeHex(c);

  const background = bgBuf
    ? `<image href="${dataUri(bgBuf)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" />`
    : `<rect x="0" y="0" width="${W}" height="${H}" fill="${sanitizeHex(brandHex)}" />`;

  // Black shade (40% by default) so the grid stays legible over any background.
  const opacity = Math.min(1, Math.max(0, params.overlayOpacity ?? 0.4));
  const shade = `<rect x="0" y="0" width="${W}" height="${H}" fill="#000000" opacity="${opacity}" />`;

  const grid_ = buildGrid({
    W,
    H,
    iconBuf,
    slotIconBufs,
    tint,
    slotTints,
    grid,
  });

  // Flat-color silhouette of the icon's alpha: how "set the icon's color" works for any SVG.
  const colors = new Set([
    ...(tint ? [tint] : []),
    ...Object.values(slotTints),
  ]);
  const defs =
    colors.size > 0
      ? `<defs>${[...colors]
          .map(
            (c) =>
              `<filter id="${tintId(c)}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feFlood flood-color="${c}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`,
          )
          .join("")}</defs>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${background}${shade}${grid_}</svg>`;
}

function buildGrid(params: {
  W: number;
  H: number;
  iconBuf: Buffer | null;
  slotIconBufs?: Record<number, Buffer>;
  tint: string | null;
  slotTints: Record<number, string>;
  grid: StampGridLayout;
}): string {
  const { W, H, iconBuf, slotIconBufs, tint, slotTints, grid } = params;
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
  const diameterByWidth = availW / (maxRowLen + (maxRowLen - 1) * gapFactor);
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
      parts.push(
        renderSlot({
          cx,
          cy,
          d,
          filled: slot.filled,
          iconBuf: slotIconBufs?.[slot.index] ?? iconBuf,
          tint: slotTints[slot.index] ?? tint,
        }),
      );
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
  tint: string | null;
}): string {
  const { cx, cy, d, filled, iconBuf, tint } = params;
  const color = tint ?? "#ffffff";

  if (iconBuf) {
    const opacity = filled ? 1.0 : 0.25;
    const half = d / 2;
    return `<image href="${dataUri(iconBuf)}" x="${cx - half}" y="${cy - half}" width="${d}" height="${d}" opacity="${opacity}"${tint ? ` filter="url(#${tintId(tint)})"` : ""} />`;
  }

  // Shape fallback when the business has no uploaded stamp icon.
  if (filled) {
    return `<circle cx="${cx}" cy="${cy}" r="${d / 2}" fill="${color}" opacity="0.95" />`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${d / 2 - 1.5}" fill="none" stroke="${color}" stroke-width="2" opacity="0.35" />`;
}
