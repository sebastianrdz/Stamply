# Roadmap: what is missing and possible future integrations

> Status: draft, nothing here is scheduled. Written 2026-11-19 after D1 to D3, D5 v1, D6, D7 and the broadcast scale work shipped. Planning is on hold by the owner; this is the list to pick from later. Sizes are rough guesses: **S** about a day, **M** a few days, **L** one to two weeks. WhatsApp stays out of scope (README section 8).

## 1. Decided or planned, not built

| Item | Where it stands | Size | Depends on |
|---|---|---|---|
| **D4 CFDI invoicing** for Stamply's own subscriptions | PAC research done (below); no plan doc yet | L | PAC choice; Stamply's RFC and CSD |
| **Feature-guard mechanism** (capability map, `assertFeature`, locked-feature UI, billing comparison table) | Fully designed in `plan-feature-guards.md`, decisions made | M | none |
| **D5 v2: manager PIN** (one business PIN, employees only, lockout) | Model decided in `plan-d5.md` ("Later") | M | feature guards (ship gated to Medium and up) |
| **D5 v2: anomaly alerts by email** | Rule not defined (for example stamps per day above 2x the staff median, or outside opening hours) | M | a rule decision; reuses the monthly-email path |
| **D8 POS integrations** (auto-stamp on purchase) | README only | L | validating which POS customers use (Clip, Square, Loyverse, Parrot); the public API below |
| **D9 local discovery network** | README only | L | validating demand first |

### D4 CFDI: what we know so far
- **No free production PAC exists.** The free parts are sandboxes and trials (Facturama sandbox plus 15 folios, Senhub sandbox plus 5 stamps, Facturapi 14-day test mode) and the SAT's own portal, which issues one CFDI at a time by hand with no API.
- **Public prices (MXN, checked 2026-11, confirm before deciding):** Edifact about $0.45 per stamp ($450 + IVA per 1,000) with REST API; Senhub $0.80 to $0.95 per stamp, no monthly fee; Facturama API module $1,650 a year plus $0.50 to $0.40 per folio; Facturapi $299 a month plus $0.60 per invoice (its "Facturapi para Stripe" plan issues an invoice from each Stripe payment). SW Sapien and Finkok publish no prices.
- **Cost is not the deciding factor:** a stamp is about 0.1% of one Small subscription ($679). The fixed monthly fee matters at launch; at about 100 invoices a month the total is roughly $45 to $95 (Edifact, Senhub), $190 (Facturama) or $360 (Facturapi).
- **How to choose:** SAT-authorised PAC; fit with Stripe webhooks and a Node app; CFDI 4.0 features (cancellation, PDF and XML, IVA already included in the price); easy to switch (keep the provider behind one small interface and store every XML ourselves); then spend an hour in two or three sandboxes issuing one test invoice each.
- **Prerequisites that are not software:** Stamply's RFC, a CSD (digital stamp certificate), fiscal regime. Owner to confirm they exist.
- **Likely scope:** collect RFC, razón social, régimen, código postal and uso CFDI in billing settings (new migration with RLS); issue a CFDI when a Stripe invoice is paid (`app/api/stripe/webhook`); email PDF and XML through Resend; list invoices under Billing; degrade to 503 when PAC credentials are missing, like wallet and billing already do.

## 2. Advertised earlier, removed from the plan lists, not built

| Item | Notes | Size |
|---|---|---|
| **Custom enrollment fields** (was on Medium) | `customers.extra` (jsonb) already exists and is unused. Needs a per-program field editor, the join form, validation, display in the customer view. Gate to Medium and up. | M |
| **Public API access** (was on Big) | API keys table (hashed, scoped, revocable), read endpoints for customers and cards, a stamp endpoint, rate limits, docs, optional outgoing webhooks. This is also what D8 POS integrations and Zapier-style tools need. Gate to Big. | L |
| **Priority support** (Big) | Operational, not software: decide an actual response-time promise before listing it again. | n/a |

## 3. Ideas that are not in the README yet (unvalidated)

- **SMS channel:** a competitor lists it as "coming soon". Needs a provider, per-message cost, Mexican number handling and the same marketing-consent rule. Only if owners ask; wallet push already covers most cases.
- **Email to customers** (not just owners): Resend is integrated, but only for owner emails. A customer email broadcast needs consent, an unsubscribe link and sender-domain care. M.
- **Data export** (CSV of customers, activity, ROI numbers): nothing like it exists today. S.
- **Accounting or spreadsheet integrations:** Google Sheets or an accounting export once CFDI exists. Depends on D4 and the API.
- **Webhooks and automation tools** (Zapier, Make): rides on the public API.

## 4. Follow-ups from the work already shipped

| Item | Why | Size |
|---|---|---|
| **Test on real phones:** link tappability in Apple and Google wallet messages (review invite, referral invite), lock-screen notifications | Assumed in the plans, never verified; Google Wallet web was the only Google test | S |
| **Automated CI** that runs typecheck, tests and lint on every PR | PRs only showed Vercel preview checks; a build once broke because a file was not committed | S |
| **Monthly summary email:** watch the first real send (first week of December); add an unsubscribe link | Not yet sent for real; no opt-out today | S |
| **Activity feed labels:** referral bonuses show as "balance adjustment", review invites show a raw type name | Cosmetic but visible to owners | S |
| **Google design edits now wait for Google's review** after the class patch fix; owners get no hint that an edit is pending | Avoid "my design didn't change" support questions | S |
| **Customers page and per-card dashboard at scale:** the customer list shows 200 rows; `getCardBreakdown` stops at 1,000 rows | New caps go up to 25,000 customers; move to SQL aggregates and real pagination and search | M |
| **Push worker tuning from real logs:** per-batch timings are logged; claim index probe `(offer_id, customer_id) where delivered_at is null`; batch the per-recipient "delivered" writes | Details and numbers in `broadcast-scale-load-check.md` | S to M |
| **Check Google Wallet API quota** and, if the Vercel plan allows, run the push cron every 5 to 10 minutes | A lost chain link can stall a broadcast up to 24 hours on a daily-only plan | S |
| **Accounts above the new caps:** a Big account over 10 locations / programs or 50 members keeps what it has but cannot add more | Check for any, and make the "limit reached" message point to an upgrade or to support | S |
| **Confirm the Stripe webhook resets a business to no plan when a subscription is canceled** | Plan guards and scanning rely on `business.plan`; flagged as an assumption in `plan-feature-guards.md` | S |
| **Referral monitoring:** ignored referrals (phone already on file, existing customer, unknown code) are visible only in logs | An owner cannot tell why a friend did not count | S |
| **Trial length:** stays 14 days by decision; revisit with conversion data | Competitor offers 30 days | n/a |

## 5. Suggested order (when planning resumes)

1. **Cheap and safe first:** real-phone checks, CI, the small label and email fixes, the Stripe cancel check.
2. **Feature-guard mechanism:** nothing new should ship ungated after this.
3. **D4 CFDI**, once the PAC and the RFC and CSD are settled; the strongest local differentiator left.
4. **D5 v2** (PIN first, alerts after the rule is decided), gated to Medium and up.
5. **Scale hardening** (customers page, dashboard aggregates) before businesses approach thousands of customers.
6. **Public API and custom enrollment fields** (both were advertised once), then **D8 POS** and tools that depend on the API.
7. **D9 discovery, SMS, customer email:** only after validating demand with real customers.

Each item that is picked up gets its own `plan-*.md` in this folder, written the same way as the earlier ones: explore, ask the product questions, list small PRs, record what was and was not verified.
