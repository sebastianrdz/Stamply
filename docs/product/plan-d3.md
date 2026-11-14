# Plan: D3 Referral program ("Invite a friend")

> Status: draft for review, no code written yet. Each PR below is reviewed before the next starts. New migration is `0033` (D5 used `0032`).

## Context

Referrals turn loyal customers into acquisition (README D3): each customer gets a personal invite link; when the friend signs up and gets their first stamp, both get a bonus. Everything so far (D1–D6) helps retention; this is the first feature that brings in new customers. It is also the one most exposed to abuse and the one that touches the most existing flows (enrollment, stamping, wallet passes), so the plan keeps the money-adjacent logic in small, separately reviewable pieces. Stays inside README §7 (migration with RLS, es + en strings, tests, consent respected) and §8 (no WhatsApp; the customer shares the link however they like).

## Product decisions (confirmed)

| Topic | Decision |
|---|---|
| Who gets what | Both customers get a bonus, set **per program**: referrer bonus, friend bonus, monthly cap. Defaults: +1 / +1 / 5 per month. |
| Eligible programs | `stamp` and `points` only (coupon and membership cards have no balance to add to). Bonus is in that program's unit (stamps, or points). |
| When it pays out | On the friend's **first scanned stamp or spend** (staff scan). Not at sign-up. Existing automations already treat a scan as the real purchase signal. |
| Monthly cap | Per referrer card, counted over **rewarded** referrals in the business-local calendar month. Owner sets 1–20, default 5. If the cap is reached the friend still gets their bonus; only the referrer's is withheld. |
| Identity | A referral only counts if the friend gave an **email or phone**. Enrollment itself is unchanged: a friend with neither joins normally and nobody gets a bonus. |
| Duplicates | A friend is eligible only if brand-new to the business: no existing customer with the same email (already how `enroll` reuses customers) or the same normalized phone (last 10 digits). One referral per friend, ever. Self-referral is impossible by construction (the friend is a new customer). |
| Share surfaces | "Invite a friend" button on the card page + the link as text on the Apple and Google pass back. |
| Gating | All paid plans, no gating code (same as D1/D2/D5/D6). |

## How it fits what exists (findings)

- **Enrollment** is `app/c/join/[programId]` → `enroll()` in `lib/enroll/actions.ts`: reuses a customer by email (`isNewCustomer`), checks the plan customer limit, `issueCard`, `triggerWelcome`, redirect to `/c/[token]`. `email` and `phone` are both optional. There is no referral concept and no phone dedupe. The README's `/join/[token]?ref=` is not the real route; the real invite link is `/c/join/[programId]?ref=<code>` (`enrollUrl(programId)` in `lib/urls.ts` already builds the base).
- **`cards.pass_auth_token` is a credential** (Apple/Google wallet bearer token, used in `/c/[token]`). It must **not** go in a shareable link. A separate public `referral_code` is needed.
- **The stamp RPC cannot be reused for the bonus.** `apply_stamp` writes a `stamp_events` row of kind `stamp` with an employee id. A bonus written that way would count as a customer visit in the D1 ROI metrics, as a stamp by an unknown staff member in the D5 report, and against the D5 daily limit. `stamp_kind` already has `adjust`, which nothing writes and which D1/D5 ignore. So the bonus is written by a new RPC that mirrors `apply_stamp`'s balance and reward logic but records kind `adjust` with no employee.
- **Scan hook:** `app/api/scan/route.ts` reloads the card after a successful RPC (`updated`) and calls best-effort inline triggers (`triggerAlmostThere`, `triggerReviewPrompt`). The referral payout is another one, for `stamp` and `spend`.
- **Program config:** `programs.config` jsonb is validated per type with zod in `lib/programs/actions.ts` (`stampConfig`, `pointsConfig`) and edited through `lib/programs/config.ts` (`ConfigDraft`, `buildConfig`) and the card forms under `app/dashboard/cards`. README names `lib/programs/config.ts` as the home for referral settings.
- **Wallet passes:** Apple back fields are built in `lib/wallet/apple/pass.ts`, Google text modules in `lib/wallet/google/wallet.ts`. `notifyCardUpdated` refreshes both after a balance change; `notifyProgramDesignChanged` exists for program-wide refreshes.
- Plan customer limit (`assertWithinLimit`) already applies to referred sign-ups.

## DB changes: `0033_referrals.sql`

1. `cards.referral_code text not null unique default encode(gen_random_bytes(8), 'hex')`. The volatile default fills existing rows with distinct values on add.
2. `customers.phone_digits text generated always as (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)) stored`, index `(business_id, phone_digits)`. Used only to detect a returning phone number.
3. `referrals (id uuid pk, business_id → businesses, program_id → programs, referrer_card_id → cards, referred_customer_id uuid not null unique → customers, referred_card_id → cards, status text check in ('pending','rewarded','rejected') default 'pending', created_at, rewarded_at)`, all FKs `on delete cascade`, index `(referrer_card_id, rewarded_at)`. **RLS on**, select-only policy `business_id in (select auth_business_ids())`; rows are written by trusted server code (service role). Customers never read this table.
4. `pay_referral(p_referral_id uuid, p_referrer_bonus int, p_friend_bonus int, p_monthly_cap int, p_tz text)` (`security definer`, `set search_path = public`, **service_role only**, same revoke/grant pattern as `0008`). **One transaction does everything:** locks the referral row (`for update`) and returns nothing unless it is `pending`; counts the referrer card's rewarded referrals since the start of the business-local month; adds the friend's bonus and, if under the cap, the referrer's bonus using the same locking and `rewards`/`status` math as the current `apply_stamp` (stamp and points programs only, otherwise raises `bonus_not_supported`), each as a `stamp_events` row of kind `adjust` with a null employee; sets the referral `rewarded`. Returns `(referrer_card_id, referred_card_id, referrer_paid boolean)`. Because claim and both grants share one transaction, a failure rolls everything back (the referral stays `pending` and the next scan retries) and a concurrent double scan pays once. No separate claim/release step in the app.
6. Types in `src/types/database.ts`: `cards.referral_code` (optional, fixture reason as before), `Referral`, the RPCs, `customers.phone_digits`.

## Server / lib changes

- **`lib/referrals/config.ts`:** `referralConfig(program)` returns `{ enabled, referrerBonus, referredBonus, monthlyCap }` with defaults and bounds (bonus 1–5 stamps or 1–500 points, cap 1–20; friend bonus may be 0). `referralLink(programId, code)` = `${enrollUrl(programId)}?ref=${code}`.
- **Program config:** `lib/programs/config.ts` and `lib/programs/actions.ts` get an optional `referral` object for `stamp` and `points` configs (zod bounds as above), plus a "Referrals" section in the card create/edit form.
- **`lib/referrals/record.ts`:** `recordReferral(admin, { business, program, referralCode, customerId, cardId, email, phone })`, called from `enroll()` only when `isNewCustomer`: ignores unknown/foreign codes, requires the referrer card to belong to the same program, program referral enabled, friend has email or phone, and no other customer in the business shares the normalized phone; then inserts a `pending` row. **Never throws and never blocks enrollment** (logs counts/codes only, no PII).
- **`app/c/join/[programId]/page.tsx` + `enroll-form.tsx`:** read `?ref=`, pass it as a hidden field; `enroll()` reads it. No visible change for the friend beyond (optionally) a "Invited by a friend" line.
- **`lib/referrals/reward.ts`:** `triggerReferralReward(admin, card)` called after a successful `stamp`/`spend` in the scan route, next to `triggerAlmostThere`. Finds a `pending` referral for this `referred_card_id`, reads the program's referral settings (`lib/referrals/config.ts`), calls `pay_referral` (admin client), then `notifyCardUpdated` on the paid cards. A failure is logged (ids and codes only) and the referral simply stays `pending` for the next scan; never throws into the scan response.
- **Card page (`app/c/[token]/page.tsx`):** when the program has referrals enabled, an "Invite a friend" button (client component: Web Share API with a copy-link fallback) and one line explaining the bonus. Uses `card.referral_code`, never the pass token.
- **Passes:** an "Invite a friend: <link>" back field on Apple and text module on Google when referrals are enabled. Cards already issued pick it up the next time their pass refreshes; enabling referrals on a program triggers `notifyProgramDesignChanged`.
- **`lib/referrals/stats.ts`:** `getReferralStats(client, businessId, days)` counts new referred customers and rewarded referrals; shown on the dashboard home only when referrals exist.

## UI changes

- Card create/edit form: "Referrals" section (toggle, your bonus, friend's bonus, monthly cap), hidden for coupon and membership.
- Card page: invite button.
- Dashboard home: a small "Referrals" stat row (referred, rewarded) when there is data, same range selector as D1.

## i18n (es + en)

`dashboard.programs.referral.{title, toggle, referrerBonus, friendBonus, monthlyCap, hint, errors…}`, `card.referral.{cta, share, copied, explainer}`, `wallet.inviteLabel`, `dashboard.overview.referrals.{referred, rewarded}`, `customerJoin.invitedBanner`. Spanish is primary copy, for example "Invita a un amigo: los dos ganan un sello".

## Plan gating

None (all paid plans). Plan feature copy and landing mention in the last PR (README §7).

## Tests (vitest, next to the code)

- `lib/referrals/config.test.ts`: defaults, bounds, unsupported types, link building.
- `lib/referrals/record.test.ts`: records a pending referral; ignores an unknown code, a code from another program/business, a referral-disabled program, a friend with neither email nor phone, a friend whose phone digits already exist (different formatting, e.g. `+52 55 1234 5678` vs `5512345678`), and a returning customer; a DB error never throws.
- `lib/referrals/reward.test.ts`: calls `pay_referral` with the program's bonuses and cap and refreshes both cards; refreshes only the friend's card when the referrer wasn't paid; RPC error leaves the referral for retry and never throws; no pending referral does nothing.
- `lib/enroll/actions.test.ts`: referral recorded only for new customers and never changes the redirect or breaks enrollment on failure.
- Scan route test: `stamp`/`spend` call the trigger, redeems do not.
- Settings/program config tests: valid and invalid referral settings.
- SQL (no harness in repo): seeded throwaway-Postgres check that `pay_referral` matches `apply_stamp`'s balance and goal-reached math for stamp and points cards, writes `adjust` events (and that `roi_summary`, `employee_activity` and `customer_stamps_today` ignore them), pays at most once (a second call returns nothing), withholds only the referrer's bonus at the cap and respects the business-local month boundary, rolls back fully on error, is not callable by `authenticated`, `referral_code` values are unique and backfilled, and RLS hides another business's referrals.

## PRs (small, in order, stacked)

1. **DB:** `0033_referrals.sql` (including `pay_referral`) + types. Nothing visible changes.
2. **Program referral settings:** config schema + form section + strings. Owners can configure it; nothing happens yet.
3. **Invite link + sign-up capture:** card-page invite button, `?ref=` on the join page, `recordReferral` in `enroll()`, strings, tests. Friends are linked to their referrer as `pending`; no bonus yet.
4. **Bonus payout:** `triggerReferralReward` calls `pay_referral` on the first scan, wallet refresh, tests. The risky one; reviewed alone.
5. **Pass back field:** Apple and Google invite link, plus the program-wide refresh when enabling.
6. **Stats + copy:** dashboard referral numbers, plan/landing copy.

## Verification

- Throwaway Postgres (same setup as D1/D2, D5, D6): apply `0033`, seed businesses, cards and referrals, run the SQL checks above.
- `pnpm --filter app typecheck` and `pnpm --filter app test`.
- Run the app: enable referrals on a stamp program; open a card page and copy the invite link; sign up a new friend through it with an email; confirm a `pending` referral; scan the friend's first stamp as staff and confirm both cards gained the bonus and a second stamp pays nothing more; repeat with the friend's phone in another format (no referral), a friend with no contact info (no referral), and six referrals in a month (sixth pays only the friend); confirm the ROI numbers and the staff report did not count the bonuses; check both passes refresh and show the invite link on a real iPhone and Android.

## Risks

- **Payout is money-adjacent.** It is isolated in PR 4 and is a single service-role-only transaction (claim plus both grants), so it is idempotent and all-or-nothing. The only non-atomic step is the wallet refresh afterwards; if that fails the balances are correct and the pass catches up on its next refresh.
- **Soft identity checks.** A determined abuser can still use a fresh email or phone per fake friend; the first-scan rule (a real staff-scanned transaction) and the monthly cap are the real limits. A cooperating cashier is out of scope (D5 report and daily limit help).
- **Bonuses show as "balance adjustment" in the activity feed** (the existing `adjust` label). Good enough for v1; a dedicated label is a small follow-up.
- Existing passes only show the invite link after their next refresh.
- Phone matching uses the last 10 digits, so numbers from different countries with the same last 10 digits would collide (rare; errs on the safe side of withholding a bonus).
- Not covered: rewarding the referrer with a non-stamp reward (free item), tiered referral rewards, leaderboards.
