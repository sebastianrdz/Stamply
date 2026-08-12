import "server-only";

/**
 * Fetch a remote image and inline it as a `data:` URL.
 *
 * Why: the printable QR templates (src/app/dashboard/programs/[programId]/templates/)
 * embed a business's logo/background as an SVG `<image href="...">`, then
 * rasterize that SVG client-side via `new Image()` → `<canvas>` for the PNG
 * download (see download-svg.ts). A remote http(s) `href` is not fetched by
 * the browser in that pipeline, and even if it were, a cross-origin,
 * non-CORS source would taint the canvas and break `canvas.toBlob`. Resolving
 * to a `data:` URL here — server-side, before it ever reaches the SVG — has
 * no CORS restriction and sidesteps both problems for the live preview *and*
 * the exported PNG.
 *
 * Returns `null` on a missing URL or any fetch/read failure — never throws.
 * Callers should treat `null` the same as "no image": the templates already
 * have a brand-color/no-logo fallback for that case.
 */
export async function fetchAsDataUrl(
  url: string | null,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    // Storage providers (Supabase included) normally set this correctly; fall
    // back to a sane image default rather than failing outright if it's ever
    // missing, since the bytes themselves are still a usable image.
    const contentType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
