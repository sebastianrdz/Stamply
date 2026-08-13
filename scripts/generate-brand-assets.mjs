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

// The Stamply mark — a rubber stamp (round knob handle, flared mount, wide base
// plate, and the impression line it leaves) on a 48×48 canvas. Shared by every
// asset so the identity stays pixel-consistent across surfaces.
const MARK = `
    <circle cx="24" cy="14.5" r="5"/>
    <path d="M21.5 18.5h5l4 8h-13z"/>
    <rect x="13.5" y="25.5" width="21" height="5" rx="2.5"/>
    <rect x="16" y="35" width="16" height="2.4" rx="1.2"/>`;

// Standard icon: rounded violet tile (used for favicon, app icon, apple-icon,
// and the non-maskable PWA icons).
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="12" fill="${BRAND}"/>
  <g fill="#fff">${MARK}</g>
</svg>
`;

// Maskable icon: full-bleed violet (the OS applies its own mask/rounding) with
// the mark scaled to ~60% and centered, so it stays inside the adaptive-icon
// safe zone on Android.
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="${BRAND}"/>
  <g fill="#fff" transform="translate(24 24) scale(0.6) translate(-24 -24)">${MARK}</g>
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
