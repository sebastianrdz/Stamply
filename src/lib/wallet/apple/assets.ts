import "server-only";

// Minimal valid opaque PNG used as a placeholder pass icon/logo when a business
// has not uploaded branded artwork. Replace at runtime with the business logo
// (see buildApplePass). Apple requires an icon.png; this keeps passes valid.
const PLACEHOLDER_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function placeholderIcon(): Buffer {
  return Buffer.from(PLACEHOLDER_PNG_BASE64, "base64");
}

/** Fetch a business logo PNG, falling back to the placeholder on any failure. */
export async function logoBuffer(logoUrl: string | null): Promise<Buffer> {
  if (!logoUrl) return placeholderIcon();
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return placeholderIcon();
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return placeholderIcon();
  }
}
