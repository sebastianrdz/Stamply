// Brand-asset generator — the single source of truth for Stamply's icon set.
//
// Defines the master SVGs (violet #7C5CFC rounded square + white "stamp" mark)
// and rasterizes the full favicon / app-icon / PWA-icon set from them with
// @resvg/resvg-js, plus multi-size favicon.ico via png-to-ico.
//
// Run:  pnpm gen:assets      (from the repo root)
// Re-run whenever the mark or brand color changes.

import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = "#7C5CFC";

// The Stamply mark (white "stamp" glyph) on a 48×48 canvas. Shared by every
// asset so the identity stays pixel-consistent across surfaces.
const MARK_PATH =
  "M24 11c5 0 8 3.2 8 7.2 0 2.6-1.4 4.4-2.6 6-.8 1.2-1.4 2-1.4 3.2 0 1 .8 1.6 2 1.6h3A4.4 4.4 0 0 1 37.4 36v.6c0 2.4-2 4.4-4.4 4.4H15a4.4 4.4 0 0 1-4.4-4.4V36A4.4 4.4 0 0 1 15 31.6h3c1.2 0 2-.6 2-1.6 0-1.2-.6-2-1.4-3.2C17.4 22.6 16 20.8 16 18.2 16 14.2 19 11 24 11Z";

// Standard icon: rounded violet tile (used for favicon, app icon, apple-icon,
// and the non-maskable PWA icons).
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="12" fill="${BRAND}"/>
  <path d="${MARK_PATH}" fill="#fff"/>
</svg>
`;

// Maskable icon: full-bleed violet (the OS applies its own mask/rounding) with
// the mark scaled to ~60% and centered, so it stays inside the adaptive-icon
// safe zone on Android.
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="${BRAND}"/>
  <g transform="translate(24 24) scale(0.6) translate(-24 -24)">
    <path d="${MARK_PATH}" fill="#fff"/>
  </g>
</svg>
`;

function png(svg, size) {
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: "width", value: size } })
      .render()
      .asPng(),
  );
}

function write(relPath, data) {
  const abs = resolve(ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, data);
  console.log(`  ✓ ${relPath}`);
}

console.log("Generating Stamply brand assets…");

// Source SVGs (Next.js `icon` file convention → crisp <link rel=icon>).
write("apps/app/src/app/icon.svg", ICON_SVG);
write("apps/marketing/src/app/icon.svg", ICON_SVG);
write("apps/app/public/icons/icon-maskable.svg", MASKABLE_SVG);

// Apple touch icons (180×180, Next `apple-icon` convention).
for (const app of ["app", "marketing"]) {
  write(`apps/${app}/src/app/apple-icon.png`, png(ICON_SVG, 180));
}

// PWA manifest icons (app only — marketing is a website, not installable).
write("apps/app/public/icons/icon-192.png", png(ICON_SVG, 192));
write("apps/app/public/icons/icon-512.png", png(ICON_SVG, 512));
write("apps/app/public/icons/icon-maskable-192.png", png(MASKABLE_SVG, 192));
write("apps/app/public/icons/icon-maskable-512.png", png(MASKABLE_SVG, 512));

// Multi-resolution favicon.ico (16/32/48) for both apps.
const ico = await pngToIco([
  png(ICON_SVG, 16),
  png(ICON_SVG, 32),
  png(ICON_SVG, 48),
]);
write("apps/app/src/app/favicon.ico", ico);
write("apps/marketing/src/app/favicon.ico", ico);

console.log("Done.");
