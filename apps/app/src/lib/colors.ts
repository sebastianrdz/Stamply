/** Convert #rrggbb to an Apple Wallet "rgb(r, g, b)" string. */
export function hexToRgbString(
  hex: string,
  fallback = "rgb(124, 92, 252)",
): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return fallback;
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

/** Pick black or white foreground for legibility on a hex background. */
export function readableForeground(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return "rgb(255, 255, 255)";
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "rgb(17, 19, 26)" : "rgb(255, 255, 255)";
}
