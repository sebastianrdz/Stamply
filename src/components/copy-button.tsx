"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copy link",
}: {
  value: string;
  label?: string;
}) {
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
      {copied ? "Copied" : label}
    </Button>
  );
}
