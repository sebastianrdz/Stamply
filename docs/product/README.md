# Stamply — Product Positioning & Differentiation Roadmap

> **Purpose of this document:** give Claude Code (and anyone on the team) the product
> context needed to plan code changes. It describes the problems Stamply solves, what is
> already built, and the differentiators we want to add so Stamply stands out from other
> digital loyalty tools. Each proposed feature lists *why*, *scope* and *likely code
> touchpoints* so it can be turned into an implementation plan.
>
> Status: draft · Last updated: 2026-11-19 · What is left to build: `roadmap-future-integrations.md`
>
> **Scope note:** WhatsApp integration is **out of scope for now** — see section 8.

---

## 1. What Stamply is

Digital loyalty cards (stamp, points, coupon and membership) for small businesses —
cafés, barbershops, taquerías, salons, gyms and shops — that live in **Apple Wallet**,
**Google Wallet** and the web. Businesses sign up, design a card in ~2 minutes, and
staff scan the customer's QR **from the browser** to add stamps or redeem rewards.

Primary market: **small businesses in Mexico** (Spanish/English UI, MXN pricing with IVA
included, Stripe billing).

---

## 2. Problems Stamply solves

### For the business
| Problem | How Stamply solves it |
| --- | --- |
| Paper cards get lost, forgotten or thrown away, so customers never complete them | Card lives in the phone's wallet, always with the customer |
| Paper stamps are easy to fake | Stamps only via authenticated staff scan, with double-scan cooldown and activity log |
| No idea who the regulars are or who stopped coming | Customer list, analytics, activity feed |
| No channel to talk to customers after they leave | Wallet push updates, broadcast offers, automations (welcome, birthday, win-back, almost-there, unredeemed reminder) |
| Reprinting cards to change a reward or run a promo | Programs and design are edited in the dashboard; passes update live |
| Can't afford a custom app like the big chains | Wallet passes give app-like presence (lock screen, notifications) without building an app |
| Need hardware or an extra app for staff | Staff scan with any phone/tablet browser |

### For the customer
| Problem | How Stamply solves it |
| --- | --- |
| Wallet full of paper cards | All cards in Apple/Google Wallet |
| Friction: download an app, create an account | One QR scan + short form → "Add to Wallet". No app |
| Don't know progress or rewards | Card shows progress and updates in real time |
| Forget the card exists | Proximity relevance surfaces the card on the lock screen near the store |

### The underlying problem
Small businesses compete with chains that have sophisticated loyalty programs, and
**bringing back an existing customer is far cheaper than acquiring a new one**. They need a
cheap, simple way to turn first-time buyers into regulars — and to *see* that it works.

---

## 3. What is already built (baseline)

Use this to avoid re-building existing features. Paths are relative to `apps/app/src/`.

- **Multi-tenant businesses** with owner/admin/employee roles (Supabase RLS) — `lib/businesses`, `lib/team`
- **Card types:** `stamp | points | coupon | membership` — `types/database.ts`, `lib/programs/*`
- **Card design** (colors, logo, stamp icons, milestones) — `lib/programs/design.ts`, `lib/stamp-icons.ts`
- **Enrollment** via in-store QR → form (name, email, phone, marketing consent, terms) — `app/join`, `app/c`, `lib/enroll`
- **Apple Wallet:** signed `.pkpass`, PassKit web service, APNs push — `lib/wallet/apple`, `app/api/apple`
- **Google Wallet:** Loyalty class/object, save JWT, live PATCH — `lib/wallet/google`, `app/api/wallet`
- **Browser QR scanning** with cooldown — `app/dashboard/scan`, `app/api/scan`
- **Proximity relevance** via store locations — `lib/locations`
- **Automations** (cron): `welcome`, `birthday`, `unredeemed_reminder`, `win_back`, `almost_there` — `lib/automations`, `app/api/cron/automations`, `app/dashboard/automations`
- **Broadcast offers** to wallet passes — `lib/offers`, `app/dashboard/broadcast`
- **Printable marketing templates** (QR posters, SVG download) — `app/dashboard/marketing/templates`
- **Analytics:** 14-day stamps, total stamps/redemptions, active cards, redemption rate — `lib/analytics.ts`, `lib/stats.ts`
- **Activity feed** — `lib/activity`, `app/dashboard/activity`
- **Billing** with Stripe, tiers Small $679 / Medium $1,879 / Big $3,579 MXN/mo, 14-day trial, annual option, per-plan limits — `packages/plans`, `lib/billing`
- **Email** via Resend — `lib/email`, `app/api/resend`
- **Product analytics** via PostHog — `lib/posthog`
- **i18n** es-MX / en — `packages/i18n`
- **ROI dashboard** (7/30/90 days, returning customers, estimated revenue from an optional average ticket, customers at risk), **message attribution** (7-day, last message wins) and a **monthly owner summary email** — `lib/roi.ts`, `lib/attribution.ts`, `lib/roi-monthly.ts` (D1/D2)
- **Referral program** (invite link on the card page and passes, bonus on the friend's first scanned stamp, monthly cap, referrer notification) — `lib/referrals`, `app/c`, `lib/enroll` (D3)
- **Staff controls v1:** per-employee activity report and a daily stamp limit per customer with owner/admin override — `lib/staff`, `app/dashboard/team/activity`, `app/api/scan` (D5)
- **Google review invite** (automation after a first redeemed reward, tracked redirect `/r/[token]`, Leave a review button) — `lib/reviews`, `app/r` (D6)
- **Push worker for broadcasts and program-wide pass refreshes** (per-recipient delivery ledger, leased batches, time-boxed crons, progress on the broadcast history) — `lib/wallet/push-worker.ts`, `app/api/cron/wallet-push`, migration 0035
- **Plan limits (D7):** customers 500 / 5,000 / 25,000, locations 1 / 3 / 10, employees 3 / 10 / 50, programs 1 / 3 / 10 — `packages/plans`

---

## 4. Competitive reality

Apple/Google Wallet loyalty cards are **not a moat on their own** — several established
international tools already offer wallet passes, automations and push messages. On
features alone Stamply is mostly at parity.

**Positioning we want:**
> *The wallet loyalty card built for Mexican small businesses — set up in 2 minutes,
> no app for anyone, and it shows you how many customers came back because of it.*

Differentiation must come from three angles:
1. **Proven ROI** — the owner can *see* the money Stamply brings back.
2. **Local fit for Mexico** — facturación (CFDI), Spanish-first, MXN, local payment habits.
3. **Zero-friction operations** — faster enrollment, safer stamping, less work for staff.

---

## 5. Differentiators to integrate

Priority: **P0** = next, highest impact on retention/sales · **P1** = soon · **P2** = later / needs validation.

### D1. ROI dashboard — "Stamply brought back X customers" (P0) — ✅ Shipped 2026-11-14 (see `plan-d1-d2.md`, migrations 0029–0030)
**Why:** Small businesses cancel tools whose value they can't see. Current analytics show
activity (stamps, redemptions) but not *business outcomes*. This is the strongest retention lever.

**Scope:**
- New metrics: returning customers (≥2 visits) in period, repeat-visit rate, avg days between visits, customers at risk (no visit in N days), visits attributed to automations/offers.
- Optional **average ticket** setting per business (MXN) → "estimated revenue from returning visits".
- Monthly summary email to the owner ("This month: 47 customers came back, ≈$9,400 MXN").
- Period selector (7/30/90 days) instead of fixed 14 days.

**Touchpoints:** `lib/analytics.ts`, `lib/stats.ts`, `app/dashboard/page.tsx`, `lib/email`, new migration for `average_ticket_cents` on businesses, cron for monthly email.

**Acceptance:** owner sees returning-customer count and estimated revenue on the dashboard home; monthly email sends with the same numbers.

### D2. Automation & offer attribution (P0) — ✅ Shipped 2026-11-14 (see `plan-d1-d2.md`, migration 0029)
**Why:** Automations already exist, but the owner can't tell if they work. Attribution turns
"we send messages" into "this message brought 12 people back".

**Scope:**
- When a customer gets a stamp/redemption within an attribution window (e.g. 7 days) after receiving an automation or broadcast, record the conversion.
- Show per-automation and per-offer: sent, returned, conversion rate.

**Touchpoints:** `lib/automations/log.ts`, `lib/automations/deliver.ts`, `lib/offers/send.ts`, stamp RPC / `app/api/scan`, `app/dashboard/automations`, `app/dashboard/broadcast`, new migration (delivery log + conversion fields).

**Acceptance:** each automation and offer shows a "returned customers" number.

### D3. Referral program — "Invite a friend" (P1) — ✅ Shipped (see `plan-d3.md`, migrations 0033–0034)
**Why:** Turns loyal customers into acquisition. Few simple tools do this well, and it's
easy to explain to owners ("you both get a stamp").

**Scope:**
- Each card has a personal share link (`/join/[token]?ref=...`).
- When a referred customer enrolls and gets their first stamp, both receive a bonus stamp/points (configurable per program).
- Basic anti-abuse: same phone/email can't be referred twice; cap referrals per customer per month.
- Referral stats in analytics.

**Touchpoints:** `lib/enroll/actions.ts`, `app/join/[token]`, `lib/programs/config.ts` (referral settings), stamp RPCs, Apple/Google pass back fields (show share link), new migration.

### D4. CFDI invoicing (factura) for subscriptions (P1) — ⏳ Not started; PAC research done, see `roadmap-future-integrations.md`
**Why:** Mexican businesses need facturas to deduct expenses. Many foreign SaaS tools don't
issue CFDI — a real local advantage and an objection-remover in sales.

**Scope:**
- Collect RFC, razón social, régimen fiscal, código postal, uso CFDI in billing settings.
- Auto-issue a CFDI when a Stripe invoice is paid (via a PAC/API such as Facturapi), email PDF+XML to the owner, list them in Billing.

**Touchpoints:** `lib/billing`, `app/api/stripe/webhook`, `app/dashboard/settings` (billing), new migration for fiscal data and invoices, `lib/email`.

**Open questions:** PAC provider choice, cost per stamp, handling IVA already included in price.

### D5. Fraud & staff controls (P1) — ✅ v1 shipped (report + daily limit, see `plan-d5.md`, migration 0032); manager PIN and anomaly alerts not built
**Why:** Owners worry staff will give free stamps to friends. Being the "safe" option is a selling point.

**Scope:**
- Per-employee activity report (stamps/redemptions per staff, per day).
- Configurable limits: max stamps per customer per day; manager PIN to redeem.
- Alerts for anomalies (e.g. one employee stamping far above average, many stamps outside opening hours).

**Touchpoints:** `app/api/scan`, stamp RPCs (migration), `lib/activity`, `app/dashboard/team`, `lib/email` for alerts.

### D6. Google Reviews prompt (P1, small) — ✅ Shipped (see `plan-d6.md`, migration 0031)
**Why:** Cheap, highly valued by owners: happy customers who just redeemed a reward are the best review source.

**Scope:** business sets its Google review link; after a redemption (or Nth visit), the pass back / a wallet offer / email invites the customer to leave a review. Track clicks.

**Touchpoints:** `lib/businesses` (review URL), `lib/rewards`, `lib/wallet/notify.ts`, `lib/offers`.

### D7. Entry pricing & plan limits review (P1 — business decision) — ✅ Limits updated, prices unchanged (see `plan-d7.md`, `plan-feature-guards.md`)
**Why:** Small plan ($679 MXN/mo, 1 location, 1 employee, 100 customers) may feel tight compared with competitors, and 100 customers can be reached in weeks by a busy café.

**Options to evaluate:** raise customer cap on Small; a cheaper "Starter" tier; usage-based add-ons. Code impact is mostly in `packages/plans` and limit checks.

**Outcome (2026-11):** limits only, no price change, no new tier: Small 500 customers / 1 location / 3 employees / 1 program; Medium 5,000 / 3 / 10 / 3; Big 25,000 / 10 / 50 / 10. Unbuilt features ("Custom enrollment fields", "API access") were removed from the plan lists. Existing features stay open on every paid plan; a feature-guard mechanism is planned but not built.

### D8. POS integrations — auto-stamp on purchase (P2) — ⏳ Not started
**Why:** Removes the scan step entirely for businesses that use a POS. Candidates popular in Mexico: Clip, Square, Loyverse, Parrot (restaurants).

**Scope:** webhook/API integration that matches a sale to a customer (phone) and stamps automatically; points by amount spent for points programs.

**Touchpoints:** new `app/api/integrations/*`, `lib/integrations/*`, stamp RPCs. Needs validation of which POS our target customers use.

### D9. Local discovery network (P2) — ⏳ Not started
**Why:** Network effect: customers with one Stamply card discover other nearby Stamply businesses ("Stamply in Monterrey"). Gives businesses new customers, not only retention.

**Scope:** opt-in public directory page per city, "nearby businesses" link on the customer card page. Validate demand first.

---

## 6. Suggested sequencing

1. ~~**D1 ROI dashboard + D2 attribution**~~ — ✅ shipped 2026-11-14.
2. ~~**D6 Google Reviews**~~ — ✅ shipped.
3. ~~**D3 Referrals** and **D5 staff controls**~~ — ✅ shipped (D5 v1).
4. **D4 CFDI** — when selling to more formal businesses; strongest local differentiator in scope. Needs a PAC choice and Stamply's own RFC and CSD first.
5. ~~**D7 pricing review**~~ — ✅ limits updated.
6. **D8 / D9** after validating with customers.
7. Everything else that is missing (feature guards, D5 v2, public API, custom enrollment fields, scale follow-ups, small fixes): `roadmap-future-integrations.md`.

---

## 7. Notes for implementation planning (Claude Code)

- Read `AGENTS.md` first: this repo uses a Next.js version with breaking changes; check `node_modules/next/dist/docs/` before writing code.
- Monorepo with pnpm: `apps/app` (product), `apps/marketing` (landing), `packages/{i18n,plans,ui}`.
- DB changes go in new numbered migrations under `apps/app/supabase/migrations/` (latest is `0035_wallet_delivery_queue.sql`); keep RLS on all new tables.
- Every user-facing string must be added to both `es` and `en` dictionaries in `packages/i18n`.
- New paid features must respect plan limits in `packages/plans` and degrade gracefully when credentials (e.g. PAC for CFDI) are not configured, as wallet and billing already do (return 503).
- Respect marketing consent for any outbound message (email, push offers).
- Do **not** add WhatsApp integration (see section 8).
- Add tests next to the code (`*.test.ts`), following existing patterns.
- Open PRs against `development` (stack dependent PRs on the branch below); `development` is merged into `main` to release.
- Update the landing page (`apps/marketing`) copy when a differentiator ships.

---

## 8. Out of scope (for now)

- **WhatsApp integration** — sending card links, automations or counter enrollment via WhatsApp. Deferred by product decision (2026-11-13). Customer communication stays on wallet push, broadcast offers and email. Do not plan or implement WhatsApp features until this section is updated.
