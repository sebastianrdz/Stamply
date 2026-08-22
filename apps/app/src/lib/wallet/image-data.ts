import "server-only";

/** Sniff enough of an image buffer to build a correct data: URI mime type. */
export function sniffMime(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (buf.length >= 6 && buf.toString("ascii", 0, 3) === "GIF")
    return "image/gif";
  // Unknown / text-based (e.g. an uploaded SVG, the only text-based type we
  // serve) falls back to SVG.
  return "image/svg+xml";
}

/** Build a `data:` URI (base64) for embedding an image in an SVG `<image>`. */
export function dataUri(buf: Buffer): string {
  return `data:${sniffMime(buf)};base64,${buf.toString("base64")}`;
}
