"use client";

import posthog from "posthog-js";

let initialized = false;

/**
 * Initializes the posthog-js singleton once per page load. Guarded by a
 * module-level flag so React Fast Refresh (or re-mounting the provider)
 * doesn't call `init` more than once. No-ops entirely when the public key
 * isn't set (e.g. local dev without PostHog configured).
 */
export function initPostHog() {
  if (initialized) return;
  if (typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    // This integration is scoped to explicit, curated events only — not
    // blanket capture of every click/input. Autocapture also attaches
    // $current_url/element context to those events, which would reintroduce
    // the same secret-token-in-URL exposure that redact-url.ts guards
    // against for pageviews.
    autocapture: false,
  });
  initialized = true;
}

export { posthog };
