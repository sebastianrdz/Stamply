"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { initPostHog, posthog } from "@/lib/posthog/client";
import { redactSensitivePath } from "@/lib/posthog/redact-url";

function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const search = searchParams.toString();
    const rawUrl = search ? `${pathname}?${search}` : pathname;
    const url = redactSensitivePath(rawUrl);
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense>
        <PostHogPageview />
      </Suspense>
      {children}
    </PHProvider>
  );
}
