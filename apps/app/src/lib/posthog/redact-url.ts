/**
 * Redacts secret bearer tokens embedded directly in a URL path before it's
 * sent to PostHog as $current_url on a $pageview capture.
 *
 * - /c/<token> (the customer card's unauthenticated pass_auth_token bearer
 *   credential, see apps/app/src/app/c/[token]/page.tsx) -> /c/[redacted] —
 *   but NOT /c/join/... (apps/app/src/app/c/join/[programId]/page.tsx, a
 *   different route: the enrollment form. Its [programId] is not a secret).
 * - /join/<token> (a team-invite secret from lib/team/actions.ts, see
 *   apps/app/src/app/join/[token]/page.tsx) -> /join/[redacted].
 *
 * Only the path is redacted; an existing query string is left as-is (this
 * app doesn't put secrets in query params for these routes).
 */
export function redactSensitivePath(url: string): string {
  return url
    .replace(/^\/c\/(?!join(?:\/|$))[^/?#]+/, "/c/[redacted]")
    .replace(/^\/join\/[^/?#]+/, "/join/[redacted]");
}
