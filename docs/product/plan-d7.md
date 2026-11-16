# D7: Plan limits review (limits only)

> Status: implemented in one PR (limits revised after review: Big is 10 / 10 / 50 and customers are 500 / 5,000 / 25,000). Prices unchanged. New limits apply immediately; no Stripe or database change (limits live only in `packages/plans/src/index.ts` and are checked when something is added, so existing data is never removed).

## Goal and rules (confirmed)

- Goal: **more paying signups** (a Small trial should not hit a wall in the first weeks).
- Levers: **limits only**. No price changes, no new tier, no add-ons.
- Original rule was "only raise limits, never lower them". Big was unlimited on locations, programs and employees, so any cap lowers it. The owner first chose 5 / 5 / 20, then, after the competitor comparison (`plan-feature-guards.md`), settled on **10 locations / 10 programs / 50 employees**, matching Loyalz Business. See "Big" below.

## Competitor benchmark (public pages, checked 2026-11)

| Tool | Plan | Price | Customers | Locations | Staff | Programs |
|---|---|---|---|---|---|---|
| **Loyalz Club** | Start | $39 USD/mo | not capped (unlimited cards) | 1 | 0 managers | 1 |
| | Grow | $89 USD/mo | not capped | 3 | 10 managers | 3 |
| | Business | $249 USD/mo | not capped | 10 | 50 managers | 10 |
| **Carrott** | Go | £29/mo per location | 250 active | per-location pricing | 1 | stamp cards only |
| | Plus | £59/mo per location | unlimited | per-location pricing | 5 | stamp + points |
| | Pro | £99/mo per location | unlimited | per-location pricing | 15 | stamp + points + membership |
| **Motivecard** | not published | | | | | no pricing or limits on the public site (404 on /precios, /planes, /pricing); only "full access with any of our paid plans" |

Reading it:
- Neither competitor with public data caps customers on its paid plans (Carrott only on its cheapest tier, at 250). Stamply's old caps (100 / 1,000 / 10,000) were the outlier, and 100 on Small was the biggest conversion risk. The owner then chose deliberately conservative new caps (500 / 5,000 / 25,000): still well above the old ones, and closer to what the app can serve today (see the scale risks below). Small at 500 is above Carrott Go (250) but far below an uncapped Loyalz Start, so a busy café can still reach it; watch how many trials hit it.
- Loyalz Grow is exactly 3 locations / 3 programs / 10 managers, which is now Medium's 3 / 3 / 10.
- Carrott charges per location, so its real price rises with every site; Stamply's flat plans are cheaper for multi-site businesses.
- Rough price context (assumes ~18 MXN/USD and ~23 MXN/GBP; check current rates): Loyalz Start ≈ $700, Grow ≈ $1,600, Business ≈ $4,500 MXN; Carrott Go/Plus/Pro ≈ $670 / $1,360 / $2,280 MXN **per location**. Stamply: $679 / $1,879 / $3,579.

## New limits

| | Small | Medium | Big |
|---|---|---|---|
| Customers | 100 → **500** | 1,000 → **5,000** | 10,000 → **25,000** |
| Locations | 1 | 3 | unlimited → **10** |
| Employees (counts the owner) | 1 → **3** | 5 → **10** | unlimited → **50** |
| Programs | 1 | 3 | unlimited → **10** |

Also in this change (copy honesty): "Custom enrollment fields" (Medium) and "API access" (Big) are removed from the feature lists because neither is built, and the Medium "Analytics dashboard" line (every plan has the dashboard now) becomes "Staff activity and daily stamp limits", also listed on Big. The free trial stays at 14 days.

Changed in: `packages/plans/src/index.ts` (limits and feature lines), `packages/i18n/src/dictionaries/{es,en}.json` (pricing and billing feature lists), and the limit tests (`plans.test.ts`, `entitlements.test.ts`). `null` (unlimited) is still supported by the limit code; no shipped plan uses it now, so the tests set it temporarily.

## Big is now lower than before

Big used to be unlimited on locations, programs and employees. Capping it at 10 / 10 / 50 puts it level with Loyalz Business (10 / 10 / 50) at a lower price. It is still a deliberate cut, with these consequences:

- Limits are checked only when adding (`assertWithinLimit`): a Big account that already has more than 5 locations, 5 programs or 20 team members keeps everything it has but cannot add more, and its team page badge reads over the limit (for example "55 / 50 members").
- Before shipping, check whether any Big account is above 10 locations, 10 programs or 50 members (a count per Big business). If one is, contact them or raise the cap.
- The marketing and pricing pages now say "Up to 10 locations" / "10 loyalty programs" / "50 employees" for Big.

## Risks and follow-ups (not in this change)

The new customer caps are 50x the old ones, and some code assumes small numbers:

1. **Broadcasts and design pushes run inline** in one request (`notifyOffers`, `notifyProgramDesignChanged` in `lib/wallet/notify.ts`, both marked `shortcut:`). Thousands of passes in one request can hit the function timeout. Highest priority: queue or chunk them.
2. **Per-card dashboard breakdown** (`getCardBreakdown`) aggregates in JavaScript over PostgREST's 1,000-row cap, so customer/card/stamp counts per card stop at 1,000. Move it to a SQL aggregate.
3. **Customers page** lists the latest 200 only; it needs real pagination and search.
4. The daily automations cron loads all customers of each business in memory; fine into the low thousands, revisit before tens of thousands.

## Verification

- `pnpm -r typecheck` and `pnpm --filter app test` pass.
- After deploying: open the pricing page (es and en) and the billing page and confirm the new numbers; create a 4th team member on Small and confirm it is blocked at the 4th.
