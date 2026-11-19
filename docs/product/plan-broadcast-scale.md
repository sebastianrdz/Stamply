# Plan: broadcast and wallet-push scale fix

> Status: ✅ shipped as PRs #66 to #72 (migration 0035); measurements in `broadcast-scale-load-check.md`. Triggered by the D7 limits (customers 500 / 5,000 / 25,000): code written for a few hundred passes will break well before the new caps.

## 1. What breaks today (findings)

All in `apps/app/src/lib/wallet/notify.ts` and `lib/offers`:

1. **Silent truncation at 1,000 cards (a correctness bug, not just speed).** A broadcast to all opted-in customers loads its targets with one `cards` query that has no pagination (`offerTargets`, the `customer_id === null` branch). PostgREST returns at most 1,000 rows, so a business with 3,000 opted-in customers reaches the first 1,000 and the owner is told "sent". `notifyProgramDesignChanged` has the same flaw (one unpaginated `cards` select, so only the first 1,000 passes are refreshed). Old caps hid this (Medium was 1,000); **merging the new limits (#63) exposes it immediately for any Medium business above 1,000 and every Big business above 1,000.**
2. **Everything runs inline in the request that the owner clicks.** `sendOffer` awaits `sendWalletOffers` -> `notifyOffers`. Per 200-card chunk it does DB updates and an APNs batch, then Google `addMessage` calls in groups of 20, one HTTP call per Google pass. At roughly 0.3 s per call and 20 in parallel that is about 65 passes per second, so 5,000 Google passes take around 75 s and 25,000 about 6 minutes (an estimate; measure before relying on it). No route sets `maxDuration`, so the platform default applies and the request can be killed midway, with no record of who was reached.
3. **`notifyProgramDesignChanged` is much heavier per card:** a Google patch re-renders the stamp strip image and uploads it for every card (`patchLoyaltyObject`), sequentially in groups of 20. Thousands of cards cannot finish in one request.
4. **No partial-progress record.** If the request dies after 2,000 of 5,000, nothing says which passes got the offer, and a retry would re-send to everyone (`addMessage` adds a message each time).
5. **The daily cron** (`runCronAutomations`) processes every candidate of every business in one run (20 at a time). A business that enables win-back with thousands of lapsed customers makes the first run very long; there is no time budget.
6. **Offers to one customer** (automations, referral and review messages) go through the same code but with one card each, so they are fine.

## 2. Design

Principle: **the request records the work; a worker does it in small, resumable batches.** Reuse what already exists instead of adding a generic queue.

### 2.1 Offers: use `wallet_offer_recipients` as the work list

`wallet_offer_recipients` (migration 0029) already gets one row per consenting customer from a SQL trigger when an offer is created, with no row cap. Extend it into the delivery ledger:

- `delivered_at timestamptz`, `attempts int default 0`, `claimed_until timestamptz`, `last_error text`.
- Partial index `(offer_id) where delivered_at is null`.
- **`claim_offer_recipients(p_offer_id, p_limit, p_lease_seconds)`** (service role only): selects up to `p_limit` undelivered rows with `for update skip locked`, sets `claimed_until = now() + lease`, increments `attempts`, returns them. Several workers can run at once without overlap; a crashed worker's rows become claimable again after the lease.
- **Worker batch** (200 recipients): load the recipients' cards (a customer may have several), bump `cards.updated_at`, send Apple pushes, add Google messages with bounded concurrency (about 10) and retry-after on 429, then set `delivered_at` for the rows that succeeded. Rows failing three times get `last_error` and stay undelivered but stop being claimed; counts of delivered / failed / pending come straight from this table.
- Because delivery is tracked per recipient, **a re-run never double-sends** (idempotent resume), which fixes finding 4.
- Per-customer offers (automations, referral, review) keep delivering synchronously and mark `delivered_at` immediately, so every offer has consistent status.
- Backfill: offers older than 0029 have no recipient rows and are treated as complete.

### 2.2 Design changes and bulk card refreshes: a refresh queue

- A `wallet_refresh_queue` table (one row per card still to refresh, with a lease and an attempt count), **not** a flag or timestamp on `cards`: the `cards_updated_at` trigger bumps `updated_at` on every update to a card, so a marker on `cards` would make Apple devices refetch passes that did not change.
- `request_program_wallet_refresh(program_id)` bumps `updated_at` for the program's cards (so Apple's refetch sees a change) and queues every card in one SQL statement, uncapped. `notifyProgramDesignChanged` calls it and kicks the worker instead of looping inline.
- The worker claims batches with `claim_wallet_refresh` (same `skip locked` lease contract), notifies Apple and patches Google (with the strip render) at lower concurrency, and deletes the queue row of each card it finished.
- Single-card changes (a scan stamping one card) keep using `notifyCardUpdated` inline; they are already O(1).

### 2.3 Running the worker

- **`app/api/cron/wallet-push/route.ts`** (bearer `CRON_SECRET`, `export const maxDuration`, a wall-clock budget of about 80 percent of it): loops claim -> deliver -> mark until the budget is spent, then returns counts only (no PII, same rule as the automations cron).
- **Kick-off:** after the owner clicks send, `after()` (Next.js, runs after the response) calls the same drain function, so delivery starts immediately and the owner's page returns at once.
- **Continuation, no new infrastructure needed:** when the budget runs out with work left, the worker re-invokes its own route with the secret from `after()`. This chains until the backlog is empty.
- **Safety net:** a cron entry calls the route on a schedule, picking up anything left by a crash. The frequency depends on the Vercel plan (daily crons only on Hobby, down to every minute on Pro; to confirm). With the self-chaining above, a daily safety net is acceptable.
- Parameters in one config object (batch 200, Google concurrency 10, lease 120 s) so they can be tuned from measurements.

### 2.4 Owner-facing behavior

- Sending shows "Sending to 4,812 customers, usually a few minutes" and the history row shows live **delivered N of M** and **failed K** from the recipients table (a small client component refreshes it every few seconds while anything is pending).
- The daily limit of 5 offers per business (`MAX_PER_DAY`) is unchanged.

### 2.5 Automations cron

- Add a time budget to `runCronAutomations` (stop starting new businesses and new batches near the limit). The claim row per (automation, customer, period) already makes the next run continue where it stopped, so a huge first run simply finishes over several days or hours. Counts report "deferred".

## 3. PRs (small, in order)

0. **Hotfix, ship before or with #63:** paginate `offerTargets`, the `apple_registrations` lookup and `notifyProgramDesignChanged` with the existing `fetchAll` so nothing is silently cut at 1,000, plus tests for 2,500 targets. No design change; it makes today's inline path correct (slow but complete) until the worker lands.
1. **Migration `0035`** (#67): recipients ledger columns and `wallet_offers.delivery`, the refresh queue table, the claim, status and finish functions, indexes. Verified on a throwaway Postgres (concurrent claims do not overlap, lease expiry re-claims, RLS unchanged).
2. **Worker core + offers:** `lib/wallet/push-worker.ts` (batch delivery with per-recipient marking and retries), the cron/route, `sendOffer` switched to "record and kick off", tests with fake Apple and Google clients.
3. **Design refresh through the dirty-card path:** `notifyProgramDesignChanged` becomes mark-and-kick; worker drains dirty cards.
4. **UI:** delivery progress on the broadcast history, es + en strings.
5. **Automations cron budget** and `maxDuration` on the cron routes.
6. **Load check:** a script that seeds N thousand fake cards and runs the worker with stubbed providers to record throughput, then tune the batch and concurrency numbers.

## 4. Tests

- `offerTargets` / registrations pagination over 2,500 rows (PR 0).
- Worker: delivers every recipient exactly once across several runs; a failure leaves `delivered_at` null and increments attempts; three failures stop claiming; Apple tokens and Google calls are bounded in batches; budget exhaustion returns cleanly with work remaining.
- SQL on a throwaway Postgres: `skip locked` claiming under two concurrent sessions, lease expiry, partial index used, nothing visible to other businesses.
- `sendOffer`: returns quickly, creates the offer and recipients, never awaits delivery; rate limit and consent rules unchanged.
- UI: progress component renders pending / delivered / failed.

## 5. Risks and open questions

- **Vercel plan:** cron frequency and the maximum `maxDuration` depend on it. The design works with a daily cron because of self-chaining, but a per-minute cron makes recovery faster. Which plan is the project on?
- **Google Wallet API quota** for `addMessage` and patches is unknown; the worker honors 429 retry-after and the concurrency value is configurable. Check the quota in the Google Pay and Wallet console before sending to 25,000 passes.
- **APNs** limits are generous but a very large silent-push burst should still be paced by the batch size.
- **Notification rules on Google:** only the first 3 messages per pass per 24 h notify (already noted in `addOfferMessage`); unchanged.
- The self-chaining call relies on `after()` running to completion; if a platform kill happens mid-batch the lease expires and the next run resumes, at-least-once for that batch (Apple pushes are idempotent; a Google message could repeat once for the batch that was in flight, which per-recipient marking keeps to a small window).
- Not in scope: `getCardBreakdown`'s 1,000-row aggregate and the customers page's 200-row list, tracked separately in `plan-d7.md`.
