# E2E test coverage notes

Run with `pnpm test:e2e`. See `playwright.config.ts` for the fake-Supabase
harness (no live DB/session anywhere in this suite).

## What's covered

- `landing.spec.ts` — hero heading, header/hero CTA hrefs, pricing section
  regression check against `PAID_PLANS` (src/lib/billing/plans.ts).
- `navigation.spec.ts` — /  ↔ /login ↔ /register link wiring.
- `auth-form.spec.ts` — HTML5 required/type validation on both auth pages,
  plus real (unmocked) submission against the unreachable fake Supabase
  backend to verify the error path renders via `role="alert"` without
  crashing or navigating away.
- `not-found.spec.ts` — custom 404 page content + "Back home" link.
- `auth-redirect.spec.ts` — proxy.ts's unauthenticated-redirect behavior for
  `/dashboard` and `/dashboard/billing`, including the raw 307 + `Location`
  header (not just the client-observed final URL).
- `public-join-routes.spec.ts` — `/join/<token>` and `/c/join/<programId>`
  for nonexistent ids, which is the only branch of those pages reachable
  without a live DB.
- `wallet-degradation.spec.ts` — `/api/wallet/apple|google/<token>` 404
  `not_found` shape for a token that can't resolve to a card.

## Deliberately NOT covered, and why

- **Any authenticated flow** (dashboard content, creating a program, team
  management, billing/Stripe checkout, scan-to-stamp, actual wallet pass
  download). All of these require a real signed-in Supabase session and a
  seeded Postgres row — impossible to reach black-box against the fake
  project URL, since proxy.ts fails closed with no user. Needs a real
  Supabase test project (or a mocked session cookie the app's own
  `createServerClient` would accept, which we were told not to attempt) —
  flagging as manual-QA / integration-test follow-up.
- **The 503 `apple_wallet_unavailable` / `google_wallet_unavailable`
  graceful-degradation branch** in the wallet routes
  (`src/app/api/wallet/{apple,google}/[token]/route.ts`). That branch only
  triggers when a card *is* found but the pass-build step throws. With no
  live DB there's no way to get `getCardByToken` to return a row, so this
  path is untestable here. Manual-QA / integration-test follow-up: seed a
  card in a real (or local Supabase) DB whose business/program data is
  malformed enough to make `buildApplePass`/`googleSaveUrl` throw, then hit
  the route.
- **The `page.route()` interception of `**/auth/v1/token**`** suggested as an
  optional stretch goal was tried and abandoned — see "Surprises" below;
  `signIn`/`signUp` are Next.js Server Actions
  (`src/lib/auth/actions.ts`, `"use server"`), so the Supabase call happens
  inside the Next.js server process, never as a browser-originated request.
  Confirmed via `browser_network_requests` while submitting the login form:
  the only browser-visible request is the `POST /login` server-action call
  itself; nothing to `**/auth/v1/**` ever reaches the page's network stack,
  so a `page.route` intercept on that pattern would silently never fire.
  Instead, `auth-form.spec.ts` exercises the *real* degradation: submitting
  valid-looking credentials against the fake backend and asserting the
  resulting `role="alert"` error renders without a crash or unwanted
  navigation.
- **"Please wait…" transient pending-button text** — explicitly called out
  in the brief as flaky-prone; skipped.
- **Apple/Google Wallet button rendering on a real card page**
  (`src/app/c/[token]/...`) — requires a live card row; no such page is
  reachable without a DB.
- **Onboarding flow** (`/onboarding`) — requires a signed-in session.

## Surprises worth routing back

- `src/app/join/[token]/page.tsx` and `src/app/c/join/[programId]/page.tsx`
  use two different not-found strategies for what looks like the same class
  of failure (record doesn't exist): the invite page renders its own in-page
  200 "Invite not found" card, while the program-join page calls `notFound()`
  and returns a real 404. Both are reasonable in isolation, but worth a
  product/backend sanity check on whether that inconsistency (200 vs 404 for
  "this identifier doesn't exist") is intentional — e.g. it affects whether
  a broken/expired QR code silently renders as HTTP 200.
- Both of those pages (and the wallet routes) rely on `.maybeSingle()` /
  `.single()` calls whose `{ error }` is destructured away and discarded
  (`src/lib/cards/queries.ts:28`, `src/app/join/[token]/page.tsx:45`,
  `src/app/c/join/[programId]/page.tsx:14`). That's what makes "backend
  unreachable" and "record legitimately doesn't exist" indistinguishable
  from these pages' perspective — confirmed empirically (not just inferred)
  by booting the dev server with the fake env vars and curling both routes
  directly before writing any assertions. Fine for E2E purposes, but it
  means a real Supabase outage would present to users identically to "this
  invite/program doesn't exist," which seems worth a deliberate product
  decision rather than an accident of error handling.
