"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-render the page every few seconds while a broadcast is still being delivered. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
