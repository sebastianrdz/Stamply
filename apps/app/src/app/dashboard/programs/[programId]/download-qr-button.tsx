"use client";

import { Download } from "lucide-react";
import { Button } from "@stamply/ui/button";
import { useTranslations } from "@stamply/i18n/provider";

/**
 * Triggers a download of an already-inline QR `data:` URL. No canvas, no
 * CORS — the QR is generated server-side (see qrDataUrl in src/lib/qr.ts)
 * and is already a self-contained base64 PNG, so an <a download> click is
 * enough.
 */
export function DownloadQrButton({
  dataUrl,
  filename,
}: {
  dataUrl: string;
  filename: string;
}) {
  const dict = useTranslations();

  function handleDownload() {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      className="gap-2"
    >
      <Download className="size-4" />
      {dict.dashboard.programs.detail.downloadQr}
    </Button>
  );
}
