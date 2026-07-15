import "server-only";

import QRCode from "qrcode";

/** Render a value as a PNG data URL for an <img src>. */
export async function qrDataUrl(
  value: string,
  opts?: { width?: number; dark?: string; light?: string },
): Promise<string> {
  return QRCode.toDataURL(value, {
    width: opts?.width ?? 320,
    margin: 1,
    color: {
      dark: opts?.dark ?? "#0d0f1a",
      light: opts?.light ?? "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}
