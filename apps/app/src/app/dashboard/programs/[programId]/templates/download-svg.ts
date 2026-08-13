/**
 * Client-side SVG → high-res PNG export. No dependencies (no html2canvas, no
 * PDF lib) — just the browser's own Image/Canvas/Blob primitives.
 *
 * CORS note: any <image> inside `svg` that points at a remote http(s) URL
 * (a business's logo or background image) must already be embeddable by the
 * caller before this runs — either inlined as a `data:` URL, or served with
 * permissive CORS headers plus `crossOrigin` set on the <image> element. A
 * tainted (non-CORS) source will make `canvas.toBlob` fail below instead of
 * producing a PNG; this function surfaces that as a rejected promise so the
 * caller can show an inline error rather than fail silently.
 */
export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  width: number,
  height: number,
): Promise<void> {
  const svgString = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("Failed to load the template as an image."));
      img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("This browser doesn't support canvas 2D rendering.");
    }
    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode the PNG."));
      }, "image/png");
    });

    const pngUrl = URL.createObjectURL(pngBlob);
    try {
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(pngUrl);
    }
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
