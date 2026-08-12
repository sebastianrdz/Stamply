"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@stamply/ui/button";
import { useTranslations } from "@stamply/i18n/provider";

export function CopyButton({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const dict = useTranslations();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-2">
      {copied ? (
        <Check className="text-success size-4" />
      ) : (
        <Copy className="size-4" />
      )}
      {copied ? dict.common.copied : (label ?? dict.common.copyLink)}
    </Button>
  );
}
