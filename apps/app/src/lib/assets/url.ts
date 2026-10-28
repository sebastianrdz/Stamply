export type AssetKind = "logo" | "background" | "stamp";

// Stamp icons are SVG only; logo/background never are (same split as upload).
const NAME: Record<AssetKind, RegExp> = {
  logo: /^logo-[0-9a-f-]{36}\.(png|jpg|webp)$/,
  background: /^background-[0-9a-f-]{36}\.(png|jpg|webp)$/,
  stamp: /^stamp-[0-9a-f-]{36}\.svg$/,
};

/**
 * Trust boundary for "pick from library": a URL submitted by the client is
 * accepted only if it is exactly `{folderUrl}{kind}-{uuid}.{ext}` directly
 * inside this business's public folder (no subfolders, query, or traversal).
 * `folderUrl` is the public URL of `{businessId}/` including trailing slash.
 */
export function isBusinessAssetUrl(
  url: string,
  folderUrl: string,
  kind: AssetKind,
): boolean {
  if (!url.startsWith(folderUrl)) return false;
  return NAME[kind].test(url.slice(folderUrl.length));
}
