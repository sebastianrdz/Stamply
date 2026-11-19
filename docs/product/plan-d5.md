# Plan: D5 Staff controls (v1: per-employee report + daily stamp limit)

> Status: ✅ v1 shipped (report + daily limit; PRs #47 to #49, migration 0032). Manager PIN and anomaly alerts (the "Later" section) are not built: see `roadmap-future-integrations.md`.

## Context

Owners worry staff will give free stamps to friends (README D5). Today the scan route has only a 10-second per-card cooldown, and there is no way to see who stamped what. v1 gives owners the two cheapest, highest-signal controls: **see what each staff member does**, and **cap how many stamps one customer can get per day**. Manager PIN and anomaly alerts are deliberately left for a later version (decisions recorded below). Stays inside README §7 (migration with RLS, es + en strings, tests) and §8 (no WhatsApp).

## Product decisions (confirmed)

| Topic | Decision |
|---|---|
| v1 scope | Per-employee activity report + max stamps per customer per day. |
| Not in v1 | Manager PIN to redeem, anomaly alerts by email. Plan notes below so they can be picked up later. |
| Daily limit | One owner setting per business (empty = no limit). Counts **stamp events** per customer across all their cards in the business, per **business-local day**. A points `spend` scan counts as one event. Check-ins, redemptions and renewals are not limited. |
| At the limit | Employees are **blocked** with a clear message. **Owners and admins are allowed through** and every such override is recorded. |
| Report audience | Owner and admin only (same as the Team page). |
| Gating | All paid plans, no gating code. |
| Future PIN model (v2) | One business PIN, required for **employees only**; owners/admins redeem without it; attempt lockout. |

## What we already store (findings)

- `stamp_events` has `employee_id` (→ `auth.users`, nulled if the user is deleted), `kind` (`stamp | redeem | adjust | checkin`), `delta`, `location_id`, `created_at`. Every stamp and card redemption is already attributed to a staff member; nothing reads it for a report.
- Standalone reward redemptions are **not** in `stamp_events`: `standalone_reward_grants.redeemed_by` + `redeemed_at` hold them.
- `memberships` has `user_id`, `role` and `email` (the only place we have a staff display name). A removed member's events keep `employee_id` but lose the membership row, so the report must show "Former team member".
- `app/api/scan/route.ts`: authorization comes from the RLS-scoped `getCardByBarcode`; the stamp/redeem RPCs run as service role and are locked down (`0008_lock_down_definer_rpcs.sql`); the only guard before `apply_stamp` is the cooldown query on `stamp_events`. The route has no notion of the caller's role today.
- `apply_stamp` has been rewritten across `0002/0012/0023/0028`. Changing it is risky, so the limit is enforced in the route, like the cooldown.
- The scanner maps API error codes to strings (`scanner.tsx`, `dashboard.scan.errors.*`, e.g. `cooldown`).
- The Team page (`app/dashboard/team/page.tsx`) is `requireRole(["owner", "admin"])`, and `RANGES`/`?range=` selector pattern exists from D1 (`lib/analytics.ts`, `app/dashboard/page.tsx`).

## DB changes: `0032_staff_controls.sql`

1. `businesses.max_stamps_per_customer_per_day int null check (… is null or … between 1 and 50)`. Existing `businesses_update` policy covers it.
2. `stamp_limit_overrides (id uuid pk, business_id → businesses on delete cascade, card_id → cards on delete cascade, employee_id → auth.users on delete set null, created_at timestamptz default now())` with index `(business_id, created_at desc)`. **RLS on**, select-only policy `business_id in (select auth_business_ids())`. Rows are written by the scan route (service role).
3. `customer_stamps_today(p_business_id uuid, p_customer_id uuid, p_tz text) returns int` (`security invoker`, stable): count of `stamp_events` with `kind = 'stamp'` joined to `cards` on `customer_id`, where `(created_at at time zone p_tz)::date = (now() at time zone p_tz)::date`.
4. `employee_activity(p_business_id uuid, p_from date, p_to date, p_tz text) returns table (employee_id uuid, day date, stamps bigint, redemptions bigint, overrides bigint)` (`security invoker`, stable): union of `stamp_events` (`stamp` → stamps, `redeem` → redemptions), `standalone_reward_grants` (redeemed → redemptions, by `redeemed_by`/`redeemed_at`) and `stamp_limit_overrides`, grouped by employee and local day.
5. Grants as in 0029: revoke from `public, anon`, grant to `authenticated, service_role`.
6. `src/types/database.ts`: the new column (optional on `Business`, same fixture reason as before), `stamp_limit_overrides` table, the two functions.

## Server / lib changes

- **`app/api/scan/route.ts`:** for `stamp` and `spend`, after the cooldown check and before the RPC: if `business.max_stamps_per_customer_per_day` is set, call `customer_stamps_today` (session client). If `count >= limit`: look up the caller's role (`memberships` for this business and user). Employee → `429 daily_limit` with `{ limit }`. Owner/admin → continue and insert a `stamp_limit_overrides` row after the stamp succeeds (best-effort, logged on failure, never fails the scan). A failed count query is logged and the scan proceeds (fail open: a backend blip must not block the counter).
- **`lib/staff/report.ts`** (new): `getEmployeeReport(client, business, days)` calls `employee_activity` for `periodBounds(tz, days)` (reuse `lib/roi.ts`), resolves names from `memberships` (`email`, falling back to "Former team member"), and returns per-employee totals (stamps, redemptions, overrides, active days, stamps per active day) plus a per-day list for one employee. Pure helpers for the grouping so they are unit-testable.
- **Settings:** `settings-schema.ts` adds `max_stamps_per_customer_per_day` (optional positive int 1–50, empty clears it), `settings-actions.ts` writes it, same pattern as `average_ticket`.

## UI changes

- **Settings (`settings-form.tsx`):** a "Staff controls" fieldset: "Max stamps per customer per day" with a hint ("Employees are blocked at the limit; owners and admins can still stamp and it is recorded.").
- **Scanner (`scan/scanner.tsx`):** map `daily_limit` to a message with the limit.
- **Report (`app/dashboard/team/activity/page.tsx`, owner/admin):** 7/30/90 range pills (`?range=`), table of staff with stamps, redemptions, overrides, active days and stamps per active day; clicking a staff member (`?staff=<id>`) shows their per-day rows. A link from the Team page header.
- Loading skeleton following `team/loading.tsx`.

## i18n (es + en)

`dashboard.team.activity.{title, description, metaTitle, link, columns.{staff, stamps, redemptions, overrides, activeDays, perDay}, former, empty, dailyBreakdown}`, `dashboard.settings.businessForm.{staffHeading, dailyLimitLabel, dailyLimitHint}`, `dashboard.settings.errors.dailyLimitInvalid`, `dashboard.scan.errors.dailyLimit`.

## Plan gating

None (all paid plans). Optionally mention the report in the plan feature lines in a later copy pass (not in this scope).

## Tests

- `lib/staff/report.test.ts`: grouping by employee, former-member fallback, stamps per active day, empty period.
- Scan route tests: under the limit stamps normally; employee at the limit gets `429 daily_limit` and no RPC call; owner/admin at the limit stamps and writes one override row; no limit set skips the count; count query failure fails open; `spend` counts like `stamp`; `redeem` actions are not limited.
- Settings schema tests (valid, empty clears, 0 / 51 / non-integer rejected).
- SQL (no harness in repo): seeded throwaway-Postgres check that `customer_stamps_today` respects the business-local day boundary and sums across a customer's cards, `employee_activity` totals match seeded events including standalone redeems and overrides, and another business's session sees nothing (RLS), same setup as D1/D2 and D6.

## PRs (small, in order, stacked)

1. **DB:** `0032_staff_controls.sql` + types. Nothing visible changes.
2. **Daily limit:** setting, route enforcement, override log, scanner message, strings, tests.
3. **Employee report:** `lib/staff/report.ts`, report page, Team page link, strings, tests.

## Verification

- Apply `0032` to a throwaway Postgres, seed events over several local days and two businesses, and check both functions and RLS.
- `pnpm --filter app typecheck` and `pnpm --filter app test`.
- Run the app: set the limit to 2, scan the same customer three times as an employee (third is blocked with the message), then as an owner (third goes through), then open the report and confirm the override count and per-day numbers match.
- Change the business timezone and confirm the day boundary moves with it.

## Risks

- The limit is checked in the route, not in the database, so two simultaneous scans on different devices can both pass the check and exceed the limit by one. Same weakness as the existing cooldown; moving the check into `apply_stamp` is the fix if it matters.
- Failing open on a count error means a backend blip lets extra stamps through for that moment.
- The report only knows staff who still have a membership; deleted members appear as "Former team member".
- Owner/admin override is silent at the counter (no confirmation prompt); it is only visible afterwards in the report.

## Later (not in this scope)

- **Manager PIN:** `businesses.redeem_pin_hash` (scrypt/bcrypt), employees only, PIN prompt in the scanner before any redeem action, attempt counter with lockout via `lib/rate-limit.ts`.
- **Anomaly alerts:** needs a definition of "unusual" (for example stamps per day above 2x the staff median, or stamps outside configured opening hours), a daily check in the existing cron, and an owner email like the D1 monthly summary.
