"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";

/** Copy button for an existing invite; builds the absolute URL client-side. */
export function CopyInviteLink({ path }: { path: string }) {
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );
  return <CopyButton value={`${origin}${path}`} />;
}
