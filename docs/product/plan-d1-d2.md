# Plan: D1 ROI dashboard + D2 automation & offer attribution

> Status: approved, no code written yet. Each PR below is reviewed before the next starts.

## Context

Small businesses cancel tools when they can't see what those tools are worth. Today the dashboard shows activity (stamps, redemptions) over a fixed 14-day window. Owners can't tell how many customers came back, or whether automations and offers did anything. D1 adds those outcome numbers to the dashboard and to a monthly email. D2 credits customer visits to the message that came before them. Both stay inside README §7: new migrations, RLS on every new table, es and en strings, marketing consent respected, and no WhatsApp (§8).

## Product decisions (confirmed)

| Topic | Decision |
|---|---|
| Visit | One **visit-day** = a distinct (customer, local date in the business timezone) with a `stamp_events` row of kind `stamp`, `redeem` or `checkin`, or a `standalone_reward_grants.redeemed_at`. `adjust` is not a visit. |
| Returning customer | Has a visit-day inside the period **and** an earlier visit-day (any time before it). |
| Repeat-visit rate | Returning customers ÷ customers with ≥1 visit-day in the period. |
| Avg days between visits | Average gap, for each visit-day in the period, back to that customer's previous visit-day. |
| At risk | Last visit-day was between N and 2N days ago. N = the win-back `inactive_days` setting, or 30 if win-back is off. |
| Attribution | 7-day window, last message wins. Each visit-day is credited to the newest message that customer received in the 7 days before it. A message's "returned" = the distinct customers credited to it. 7 is a constant, not a setting. |
| Average ticket | Optional business setting in MXN. Estimated revenue = returning visit-days in the period × average ticket. If it isn't set, revenue is hidden and a "Set your average ticket" link shows in its place. |
| Gating | All paid plans. No gating code (`plan === "none"` is already redirected in `dashboard/layout.tsx`). |
| Compute on read | Conversions are computed by SQL at read time, not stored. This avoids touching the locked-down stamp RPCs, and history stays correct if the definition changes. |

## What we already store (findings)

- `stamp_events` (0001, 0022, 0023): business, card, employee, kind (`stamp|redeem|adjust|checkin`), delta, location, created_at, plus `amount_cents` on points "spend" scans. Indexes exist on `business_id` and on `created_at`, but there is no composite index on both.
- `cards.customer_id` links events to customers. `redemptions` is written by the RPCs and read by `lib/analytics.ts` and `lib/stats.ts`.
- `standalone_reward_grants.redeemed_at` holds automation reward redemptions. These are visits that don't appear in `stamp_events`.
- `automation_runs` (0026) has one row per (automation, customer, period), but it also keeps rows for customers who were **not** messaged (the `notOptedIn` claim is kept in `lib/automations/deliver.ts`). It can't be used as the "sent" count.
- `wallet_offers` (0021, plus `automation_id` from 0026): automation offers are one row per customer. A **broadcast to everyone is a single row with `customer_id = null`**, so we don't know who received it.
- `businesses.timezone` and `businesses.locale` (0027) exist, so the monthly email can be localized.
- `automation_last_visits()` (0026) works out last activity per customer for win-back.
- `getAnalytics` / `getCardBreakdown` aggregate in JS, and PostgREST caps those reads at 1000 rows (there's a `shortcut:` comment about it). New metrics must aggregate in SQL.

**Missing:** the recipient list for broadcast-to-all offers, the average ticket, a definition of a visit-day, the period aggregates, attribution, an idempotency log for the monthly email, and a `(business_id, created_at)` index.

## DB changes

### `0029_roi_attribution.sql`
1. `businesses.average_ticket_cents int null check (between 1 and 100000000)`. The existing business update policy covers it.
2. `wallet_offer_recipients (offer_id → wallet_offers on delete cascade, customer_id → customers on delete cascade, business_id → businesses on delete cascade, sent_at timestamptz, primary key (offer_id, customer_id))`, plus an index on `(business_id, customer_id, sent_at)`. **RLS on**, with a select-only policy `business_id in (select auth_business_ids())`.
3. An **after insert trigger on `wallet_offers`** (security definer, `search_path = public`) that fills recipients: `customer_id` when set, otherwise every `marketing_consent` customer of the business. Because it runs in SQL, the 1000-row cap doesn't apply and no app code changes. It uses the same consent rule as `lib/offers/send.ts`, so a comment in both places should point to the other.
4. Backfill recipients for existing per-customer offers. Older broadcast-to-all offers can't be reconstructed, so their stats show "—".
5. `create index on stamp_events (business_id, created_at)`.
6. A `customer_visit_days` view (`security_invoker = true`) giving (business_id, customer_id, visit_at) from `stamp_events ⋈ cards` and from redeemed grants.
7. `roi_summary(p_business_id, p_from, p_to, p_tz, p_at_risk_days)` (`security invoker`, stable), returning one row: `active_customers, returning_customers, returning_visits, avg_days_between, at_risk, attributed_visits`.
8. `message_attribution(p_business_id, p_since)` (`security invoker`), returning rows `(offer_id, automation_id, sent, returned)`. Recipients come from `wallet_offer_recipients`, and the last-touch join uses the 7-day window.
9. `grant execute` to `authenticated, service_role`; `revoke` from `anon`. RLS keeps a session limited to its own business, and the cron uses the service role.

### `0030_monthly_summaries.sql` (with PR 4)
`monthly_summaries (business_id, period_key 'YYYY-MM', sent_at, unique (business_id, period_key))`, **RLS on**, select-only policy. This is the same claim-then-send guard pattern as `automation_runs`.

Update `src/types/database.ts` the way the repo already does it for the new column, table and RPCs.

## Server / lib changes

- **`lib/analytics.ts`**: `getAnalytics(businessId, tz, days = 14)`. The `DAYS` constant becomes a parameter (7/30/90). `getCardBreakdown` gets the same parameter.
- **New `lib/roi.ts`**: `getRoi(client, business, days)` calls `roi_summary` and adds `estimatedRevenueCents` (null when no average ticket is set). It takes a client, so the dashboard passes the RLS client and the cron passes admin. The pure helpers `estimateRevenue()` and `periodBounds(tz, days)` live here (reuse `localDate`/`addDays` from `lib/automations/dates.ts`). The at-risk N is read with `configNumber("win_back", …)` from `lib/automations/config.ts`.
- **New `lib/attribution.ts`**: `getAttribution(client, businessId, sinceDays = 90)` calls `message_attribution` and returns `{ byAutomation: Map, byOffer: Map }`. Automation rows are summed per `automation_id`.
- **Average ticket setting**: add the field to the existing business-settings server action and form under `app/dashboard/settings`. Validate it with zod, entered as pesos and stored as cents.
- **Monthly summary**: `lib/roi/monthly.ts` exports `runMonthlySummaries(admin, now)`, called at the end of the existing `app/api/cron/automations` route (no new Vercel cron). For each business with a paid plan, when no `monthly_summaries` row exists for its previous local month: claim the row, compute `getRoi` for that month, and skip it if there were zero visits. Then email the owner (`admin.auth.admin.getUserById(owner_user_id)`) in `businesses.locale ?? "es"`. Release the claim if the send fails. Logs carry counts only.
- **Email**: a new `templates/monthly-summary-email.tsx` plus `sendMonthlySummaryEmail()` in `lib/email/send.ts`, using the existing `send()` path that never throws.

## UI changes

- **Dashboard home (`app/dashboard/page.tsx`)**: a period selector with `?range=7|30|90` (default 30) as plain `Link` pills. Check how `searchParams` works in `node_modules/next/dist/docs/` first, since it's probably async in this Next version. Add a new ROI row of `StatCard`s at the top: returning customers, repeat rate, estimated revenue (or a "Set average ticket" CTA linking to settings), and visits from messages. A second row shows avg days between visits and at-risk customers. The chart and per-card table follow the chosen range, and the labels drop the hardcoded "14d".
- **Automations (`app/dashboard/automations/page.tsx`)**: a one-line stat per automation card: "Last 90 days: sent X · returned Y (Z%)". Hidden when sent = 0.
- **Broadcast (`app/dashboard/broadcast/page.tsx`)**: each history row gets "sent X · returned Y". Add `.is("automation_id", null)` so automation messages stop showing in broadcast history (they're counted on the Automations page). Older all-audience offers show "—".

## i18n (both `packages/i18n/src/dictionaries/es.json` and `en.json`)

- `dashboard.overview.range.{7,30,90}`, `dashboard.overview.roi.{returning, repeatRate, revenue, revenueHint, setTicketCta, fromMessages, avgDaysBetween, atRisk}`
- `dashboard.analytics.stats.stampsPeriod` (replaces `stamps14d`)
- `dashboard.rewards.stats.{line, none}` and `dashboard.offers.stats.{line, unknown}`
- `settings.business.averageTicket.{label, help}`
- `email.monthlySummary.{subject, heading, returning, revenue, cta}`. Spanish is the primary copy, for example "Este mes volvieron 47 clientes, ≈ $9,400 MXN".

## Plan gating
None (all paid plans). `packages/plans` features copy: change the Small plan's "Basic stats" to mention the ROI dashboard in PR 5.

## Tests (next to the code, vitest + `lib/test-utils/supabase-mock.ts`)

- `lib/roi.test.ts`: `estimateRevenue` (null ticket gives null; rounding), `periodBounds` across timezones, and RPC row mapping.
- `lib/attribution.test.ts`: summing automation rows and keying offers.
- `lib/roi/monthly.test.ts`: previous-month key in the business timezone, a duplicate claim skips, zero visits skips, a failed send releases the claim, and a missing owner email skips.
- `lib/analytics.test.ts`: extend for the `days` parameter (7/30/90 bucket counts).
- Email render test following the pattern in `send.test.ts`.
- SQL: the repo has no DB test harness, so check against local Supabase (see Verification).

## PRs (small, in order)

1. **DB**: `0029_roi_attribution.sql` + type updates. Nothing visible changes yet.
2. **ROI dashboard**: `lib/roi.ts`, range selector, ROI stat rows, `getAnalytics(days)`, the average ticket setting, and i18n strings and tests.
3. **Attribution UI**: `lib/attribution.ts`, the stats on the Automations and Broadcast pages, the broadcast history filter, and i18n strings and tests.
4. **Monthly email**: `0030_monthly_summaries.sql`, the template, `runMonthlySummaries` hooked into the existing cron, and i18n strings and tests.
5. **Marketing copy**: `apps/marketing` landing and the `packages/plans` feature wording (README §7).

## Verification

- `supabase db reset` locally, then seed one business with customers, stamps spread over 120 days, one automation offer and one broadcast-to-all. Check by hand that `select * from roi_summary(...)` and `message_attribution(...)` match the expected counts. Also check that a second business's session sees nothing (RLS).
- `pnpm --filter app test` and `pnpm --filter app typecheck`.
- Run the app and open `/dashboard?range=7|30|90`, `/dashboard/automations` and `/dashboard/broadcast`. Set and unset the average ticket.
- Call `GET /api/cron/automations` with `CRON_SECRET` twice: one summary email (Resend test mode), and no duplicate on the second call.
