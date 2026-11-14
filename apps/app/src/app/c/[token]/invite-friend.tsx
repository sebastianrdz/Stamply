"use client";

import { useState } from "react";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";

/** Share the invite link with the Web Share API, falling back to copying it. */
export function InviteFriend({
  url,
  cta,
  explainer,
  copiedLabel,
  shareText,
}: {
  url: string;
  cta: string;
  explainer: string;
  copiedLabel: string;
  shareText: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Share sheet dismissed, or clipboard blocked: nothing to recover.
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={share}
        className={cn(buttonVariants({ variant: "primary" }), "w-full")}
      >
        {copied ? copiedLabel : cta}
      </button>
      <p className="text-muted-foreground text-center text-xs">{explainer}</p>
    </div>
  );
}
