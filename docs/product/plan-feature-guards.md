# Plan: limits recommendations and feature guards by plan

> Status: decisions made (see section 8), applied in D7; **the guard mechanism is not built** (see `roadmap-future-integrations.md`). Limits and copy are in the D7 PR (#63). Competitor data: public pages of Loyalz Club and Carrott (Motivecard publishes no pricing), checked 2026-11.

## 1. What competitors do differently

| | Loyalz Club | Carrott |
|---|---|---|
| How plans differ | **Limits only** (programs, locations, managers). Referral, automations, push and API are in every plan. | **Limits plus feature tiers**: card types (Go stamp only, Plus +points, Pro +membership), automations (basic on Plus, advanced on Pro), SMS / POS / refer-a-friend on higher tiers |
| Customer cap | none | 250 on the cheapest tier only |
| Trial | not stated | 30 days, full access |
| Price shape | flat per plan | per location |

Takeaways: nobody caps customers meaningfully, so customers are a poor upgrade lever; the two real levers are **locations/staff/programs** (Loyalz) and **advanced features** (Carrott). Stamply already beats both on card types, which are all included on every plan, so keep that as a selling point rather than gating it.

## 2. Recommendations on the limits (after D7)

| Limit | Now | Recommendation | Why |
|---|---|---|---|
| Small: 1 location, 1 program, 3 employees, 500 customers | as set | **Keep** | Matches Loyalz Start on structure and is more generous on staff (they allow 0 managers). 500 customers is 5x the old cap and above Carrott Go (250); a busy café can still reach it, so watch how many trials hit the cap. |
| Medium: 3 locations, 3 programs, 10 employees, 5,000 customers | as set | **Keep** | Identical to Loyalz Grow (3 / 3 / 10) at a similar price. |
| Big: 5 locations, 5 programs, 20 employees (as first proposed in D7) | 5 / 5 / 20 | **Raise to 10 locations, 10 programs, 50 employees** (customers 25,000). **Adopted.** | 5 locations is thin for a "multi-location brands" plan and sits below Loyalz Business (10 / 10 / 50) at a lower price; Carrott Pro has 15 staff per location. Because Big was unlimited before, 10 / 10 / 50 also hurts almost nobody who is already on it. Alternative: keep Big unlimited on locations and add per-extra-location pricing later (Carrott's model). |
| Customer caps overall | 500 / 5k / 25k (owner-chosen, after the first proposal of 5k / 20k / 50k) | **Treat as soft guardrails**, not a selling point | Competitors don't cap, and the scale work (broadcast queueing, SQL aggregates, pagination) is not done yet; do not advertise numbers the app can't comfortably serve. |
| Free trial | 14 days | **Consider 30 days** | Carrott offers 30 days with full access. Small, low-risk conversion lever; it is a one-constant change (`TRIAL_DAYS`) plus Stripe's trial setting. |

## 3. Plan benefits audit (what we advertise vs what exists)

Today the **only** thing enforced per plan is the four numeric limits (`assertWithinLimit`). Everything else is available to every paid plan, and `plan = "none"` only blocks scanning and enrolling. The feature lists are marketing text in the dictionaries and `packages/plans`.

| Advertised | Reality |
|---|---|
| "Custom enrollment fields" (Medium) | **Not built.** `customers.extra` (jsonb) exists, nothing reads or writes it. |
| "API access" (Big) | **Not built.** There is no public API. |
| "Priority support" (Big) | Operational, not software. |
| "Analytics dashboard" (Medium) | Exists, but every plan has it now (copy was changed in a PR that went to `development`, not `main`, so `main` still shows the old lines). |
| ROI dashboard, referrals, review invites, staff activity, daily stamp limit, automations, broadcasts (5 per day), marketing templates | Built, **available on every paid plan**, none enforced by plan. |

Recommendation: **stop advertising anything that isn't built.** Remove "Custom enrollment fields" and "API access" from the lists now (or build them and then list them), and make the plan differences that remain true easy to read.

## 4. Proposed capability matrix

Principle: don't take away what existing customers already use, gate what costs us more or scales with a bigger operation, and keep acquisition features open on the cheapest plan.

| Capability | Small | Medium | Big | Status |
|---|---|---|---|---|
| 4 card types, wallet passes, scanning, activity feed, marketing templates | yes | yes | yes | all plans (keep) |
| ROI dashboard + monthly email | yes | yes | yes | all plans (keep; it is the retention argument) |
| Referral program, Google review invites, welcome / birthday automations | yes | yes | yes | all plans (keep; acquisition and goodwill) |
| Win-back, almost-there, unredeemed reminder automations | yes | yes | yes | **Decision A below** |
| Staff activity report, daily stamp limit | yes | yes | yes | **Decision A below** (Small has at most 3 staff, so low value there) |
| Manager PIN, anomaly alerts (D5 v2, not built) | no | yes | yes | **new, gate from day one** |
| API access / POS integrations (not built) | no | no | yes | **new, gate from day one** |
| Custom enrollment fields (not built) | no | yes | yes | **new, gate from day one** |
| CFDI invoicing (D4, not built) | yes | yes | yes | all plans (a Mexican compliance need, not an upsell) |
| Priority support | no | no | yes | operational |

**Decision A (existing features):** moving win-back, almost-there, unredeemed reminders, staff activity and the daily limit to Medium+ would give Small owners a clear reason to upgrade and mirrors Carrott's tiering, but it **removes features Small accounts already use**, against the "never lower" rule. Options: (1) leave everything open (recommended for now, since the goal is signups), (2) gate them for new businesses only and grandfather existing ones (needs a per-business flag), (3) gate for everyone and accept the downgrade. This plan builds the guard mechanism so the choice becomes a one-line change per feature.

## 5. Feature guard design

Mirror the existing limit pattern (`isWithinLimit` / `assertWithinLimit` / `LimitExceededError`).

- **`packages/plans`:** a typed `Feature` union (for example `"win_back" | "staff_report" | "daily_limit" | "manager_pin" | "api" | "custom_fields"`), a `capabilities: Feature[]` list per plan (separate from the marketing `features: string[]`), `hasFeature(plan, feature)` and `minPlanFor(feature)`. A test asserts every `Feature` belongs to at least one plan and every plan's capabilities are a superset of the plan below it.
- **`lib/billing/features.ts` (server):** `assertFeature(business, feature)` throwing `FeatureLockedError(feature, minPlan)` and `featureEnabled(business, feature)` for silent checks.
- **Where guards go (evaluated at use time from `business.plan`):**
  - Server actions that configure a gated feature (`saveAutomation`, `updateBusiness` for the daily limit, `createProgram`/`updateProgram` for referral settings, future PIN/fields): reject with an upgrade message.
  - Things that **run** without a user (automation triggers and cron, `triggerReferralReward`, `triggerReviewPrompt`, daily-limit enforcement in the scan route, monthly email): skip silently when the feature is locked, so a downgrade pauses behavior instead of erroring.
  - Pages (`/dashboard/team/activity`): render an upgrade card instead of redirecting.
- **Downgrade semantics:** configuration is **kept**, behavior is **paused**; upgrading again resumes it. Nothing is deleted. The UI shows the setting as locked with the current value visible.
- **UI:** one `UpgradeNotice` component (feature name, minimum plan, link to `/dashboard/settings/billing`), a lock badge on locked nav items and form sections, and a plan comparison table on the billing page generated from `capabilities` and `limits` so it cannot drift from the code.
- **Edge cases to define in the PR:** `plan = "none"` (read-only dashboard, nothing runs), `subscription_status` past_due / canceled (guards trust `business.plan`, which the Stripe webhook already keeps in sync; confirm the webhook resets it on cancel), trial (same plan features as the chosen paid plan).
- **Marketing copy:** generate the feature bullet lists from `capabilities` where possible, and add a test that fails if a listed capability has no guard or no implementation.

## 6. PRs (small, in order)

1. **Capability map + helpers + tests** in `packages/plans` and `lib/billing/features.ts`. All current features are listed on every plan, so **no behavior change**.
2. **Copy honesty:** remove "Custom enrollment fields" and "API access" from the lists (es, en, plans) unless you want them built first; sync the Medium "Analytics dashboard" line; update the pricing page.
3. **Guards at the use sites** (server actions, triggers, cron, scan, pages) behind `hasFeature`. Still no behavior change until a feature is moved to a higher plan.
4. **UI:** `UpgradeNotice`, locked states, billing-page comparison table from `capabilities` and `limits`.
5. **Per-feature gating decisions** (Decision A) as separate one-line PRs, each with a grandfathering note if chosen.
6. Later features (manager PIN, alerts, custom fields, API, POS) ship with their guard from day one.

## 7. Tests

- Plan matrix: monotonic capabilities, every feature has a minimum plan, `hasFeature` for each plan including `none`.
- Each guarded action returns the upgrade error when locked and works when allowed.
- Each background trigger is a no-op when locked and unchanged when allowed.
- Page-level: the locked state renders for a lower plan (component test).

## 8. Decisions (owner, 2026-11-16)

1. **Big limits: 10 locations / 10 programs / 50 employees**, and customer caps **500 / 5,000 / 25,000** (Small / Medium / Big). Applied in #63.
2. **Existing features stay open on every paid plan** (Decision A, option 1). No gating, no grandfathering needed. The guard mechanism is built so gating a feature later is a one-line change; revisit once there is conversion data.
3. **Unbuilt features removed** from the plan lists ("Custom enrollment fields", "API access"). Done in #63. They return to the lists, with their guard, only when built.
4. **Trial stays at 14 days.**

Effect on the PRs in section 6: PR 2 (copy honesty) is already done in #63. PR 5 (per-feature gating decisions) has no work until the owner decides to gate something. What remains is PR 1 (capability map and helpers), PR 3 (guards at the use sites, no behavior change) and PR 4 (UI locked states and the comparison table), mainly to be ready for new features (manager PIN, alerts, custom fields, API, POS) that should ship guarded from day one.
