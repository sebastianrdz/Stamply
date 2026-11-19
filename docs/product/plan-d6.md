# Plan: D6 Google Reviews prompt

> Status: ✅ shipped (PRs #43 to #46, migration 0031; Google class review fix #75). Not yet verified on real phones: link tappability in Apple and Google wallet messages.

## Context

Happy customers who just redeemed a reward are the best source of Google reviews, and owners value them highly (README D6). Today there is no review link anywhere. The plan: the owner sets a Google review link, the customer gets one wallet message after their first redeemed reward, a permanent "Leave a review" button sits on their card page, and every click goes through our own redirect so we can show "invited X · clicked Y". It reuses the D2 automation, consent and attribution plumbing. Stays inside README §7 (migration with RLS, es + en strings, consent respected) and §8 (no WhatsApp).

## Product decisions (confirmed)

| Topic | Decision |
|---|---|
| Trigger | After the customer's **first** redeemed reward. Counts `redeem`, `redeem_tier`, `redeem_milestone` and `redeem_standalone_reward` scans. Not coupon use, check-in or renewal. |
| Channel | Wallet message (automation, marketing-consented customers only) **plus** a permanent "Leave a review" button on `/c/[token]`. No email. |
| Frequency | Once per customer. See "Conflict to confirm" below. |
| Tracking | Our own redirect `/r/[token]` logs a per-customer click, then sends the customer to the owner's Google link. The Automations card shows invited / clicked. We cannot know whether a review was actually posted. |
| Gating | All paid plans (same as D1/D2). No gating code. |

**Conflict to confirm:** you chose "after the first reward" and also "once per 90 days". With only the first redemption triggering, a 90-day cooldown never applies. The plan implements "first redemption only", enforced by the existing unique claim `(automation, customer, period_key = "once")`, the same way `welcome` works. If you meant to re-invite on later redemptions, change `period_key` to a 90-day bucket (one line, same helper style as `reminderBucketKey` in `lib/automations/dates.ts`).

Note on "first": the claim is per automation, so a customer who redeemed before the owner enabled the invite gets it at their next redemption. That is intended: they were never asked.

## How it fits what exists (findings)

- **Offers are plain text.** `wallet_offers.body` is capped at 200 chars and appears as an Apple back field (`lib/wallet/apple/pass.ts`, `offerBackField`) and a Google loyalty-object message (`addOfferMessage` in `lib/wallet/google/wallet.ts`). No link field is used today. Apple auto-detects URLs in back fields (assumed, verify on a real device). Google messages are not reliably tappable, which is why the card-page button exists.
- **Automations are the right vehicle.** `deliverAutomation` (`lib/automations/deliver.ts`) already gives idempotency (`automation_runs` unique key), the consent filter (via `sendWalletOffers`), the `wallet_offers` row, the D2 recipients row, and the activity-feed entry. `triggerAlmostThere` (`lib/automations/trigger.ts`) is the inline-trigger pattern called from `app/api/scan/route.ts` and never throws.
- **Scan flow.** `app/api/scan/route.ts` runs the RPC, reloads the card with relations (`updated`), then calls `notifyCardUpdated` and `triggerAlmostThere`. The review trigger goes next to that call, for the redeem actions.
- **Settings pattern.** Business fields go through `lib/businesses/settings-schema.ts` (zod, `optional()` helper, empty becomes null) + `settings-actions.ts` + `settings-form.tsx`, as `average_ticket_cents` did.
- **Click identity.** Cards have `pass_auth_token`, already used in the public URL `/c/[token]` (`getCardByToken`). Reuse it as the `/r/[token]` key; it identifies card and customer without exposing ids. `src/proxy.ts` only guards dashboard and auth pages, so `/r/*` is public.
- **D2 interaction (needs a decision, made below).** `message_attribution` and `roi_summary` credit a visit to the newest wallet message in the prior 7 days. A review invite is sent right after a redemption, so it would steal credit from a real win-back message and inflate "visits after a message". The plan excludes `review_prompt` automation messages from crediting.
- **Pass shows only the newest offer.** The review message replaces any broadcast currently shown on the pass back field until the next offer. This already happens with other automations; flag it in the PR notes.

## DB changes: `0031_review_prompt.sql`

1. `businesses.google_review_url text null check (google_review_url is null or (char_length(google_review_url) <= 500 and google_review_url ~ '^https://'))`. Host allow-list is enforced in the app (below). The existing `businesses_update` policy covers it.
2. Widen `reward_definitions_type_check` to include `'review_prompt'` (same drop/add pattern as `0026_automations.sql`).
3. `review_clicks (id uuid pk, business_id → businesses on delete cascade, customer_id → customers on delete cascade, source text check in ('message','card_page'), clicked_at timestamptz default now())` with indexes `(business_id, clicked_at desc)` and `(business_id, customer_id)`. **RLS on**, select-only policy `business_id in (select auth_business_ids())`. Rows are written by the redirect route (service role).
4. `review_clicks_summary(p_business_id uuid, p_since timestamptz)` (`security invoker`, stable) returning `(clicks bigint, clickers bigint)` (distinct customers). Grants as in 0029: revoke from `public, anon`, grant to `authenticated, service_role`.
5. `create or replace` the two D2 functions (`roi_summary`, `message_attribution`) so the recipients lookup ignores offers whose `automation_id` points at a `review_prompt` definition. Verify with the seeded throwaway-Postgres check used in PR 1 of D1/D2.
6. Update `src/types/database.ts`: `RewardType`, `Business.google_review_url?` (optional for the fixture reason noted there), `review_clicks` table, `review_clicks_summary` function.

## Server / lib changes

- **`lib/reviews/url.ts`** (new): `isReviewUrl(url)`: `https:` only, host allow-list (`google.com`, `www.google.com`, `g.page`, `maps.app.goo.gl`, `goo.gl`, `search.google.com`, `g.co`, `share.google`; exact match or subdomain); and `reviewLink(token)` = `${appUrl()}/r/${token}` (`appUrl` from `lib/urls.ts`).
- **`app/r/[token]/route.ts`** (new, GET, `runtime = "nodejs"`): admin client, `getCardByToken`; no card gives 404; business without a URL redirects to `/c/[token]`; otherwise insert a `review_clicks` row (`source` from `?s=card`, default `message`; insert failure is logged, never blocks), then `NextResponse.redirect(business.google_review_url)`. Redirects only to the stored, validated value. Rate-limit by token/IP with `lib/rate-limit.ts` as other public routes do.
- **`lib/automations/config.ts`**: add `"review_prompt"` to `AUTOMATION_TYPES` (no `CONFIG_FIELDS` entry). `renderMessage` truncates at 200 chars, which could cut the link; for this type the template is limited to 120 chars of text and `{link}` is required, so the rendered message stays under 200 (measure token length when implementing; a test asserts it).
- **`lib/automations/trigger.ts`**: `triggerReviewPrompt(admin, card)` modelled on `triggerAlmostThere`: active automation of type `review_prompt`, business has `google_review_url`, then `deliverAutomation(admin, def, customerId, "once", { name, business, link })`. Never throws.
- **`app/api/scan/route.ts`**: after the reload, for `redeem | redeem_tier | redeem_milestone | redeem_standalone_reward`, call `triggerReviewPrompt(admin, updated)` next to `triggerAlmostThere`.
- **`lib/rewards/actions.ts` (`saveAutomation`)**: for `review_prompt`, enabling requires the business review URL (error pointing to Settings) and `{link}` in the message; reward field ignored.
- **Settings:** `settings-schema.ts` adds `google_review_url: optional(z.string().trim().max(500).url().refine(isReviewUrl, msg))`; `settings-actions.ts` writes it.
- **`lib/reviews/stats.ts`** (new): `getReviewStats(client, business, days = 90)` calls `review_clicks_summary`; the invited count comes from the existing `getAttribution().byAutomation` `sent`.

## UI changes

- **Settings (`settings-form.tsx`):** "Google review link" input with hint on where to find it (Google Business Profile, "Get more reviews").
- **Card page (`app/c/[token]/page.tsx`):** a "Leave a review" button linking to `/r/[token]?s=card`, shown only when the business has a review URL.
- **Automations (`app/dashboard/automations`):** new `review_prompt` card (message textarea with `{link}` hint, active toggle, no reward field; if the business has no review URL, a warning with a link to Settings). Its stats line is "Last 90 days: X invited · Y clicked" instead of the "came back" line (`page.tsx` already has the attribution map; add the click summary).
- **Activity feed:** `automation_sent` shows the detail text of the type; check the label for the new type when implementing.

## i18n (es + en, `packages/i18n/src/dictionaries`)

`dashboard.rewards.types.review_prompt.{title, description, defaultMessage, linkHint, missingUrl}`, `dashboard.rewards.stats.reviewLine`, `dashboard.rewards.errors.{linkRequired, reviewUrlRequired}`, `dashboard.settings.businessForm.{reviewUrlLabel, reviewUrlHint}`, `dashboard.settings.errors.reviewUrlInvalid`, `card.review.cta`. Spanish is primary copy, for example "¡Gracias por visitarnos, {name}! ¿Nos dejas una reseña? {link}".

## Plan gating

None (all paid plans). Landing/plan copy (README §7) in the last PR.

## Tests (vitest, next to the code, existing mock helpers)

- `lib/reviews/url.test.ts`: https only, allowed hosts and subdomains, rejects lookalikes (`google.com.evil.io`, `evilgoogle.com`), rejects `javascript:` / `http:`.
- `app/r/[token]/route.test.ts`: redirects to the stored URL and logs a click; unknown token gives 404; no URL redirects to `/c/[token]`; click-insert failure still redirects; `?s=card` is recorded.
- `lib/automations/trigger` test for `triggerReviewPrompt`: skips when inactive, when no URL; sends with the tracking link; second redemption is a no-op (`duplicate`); never throws.
- Scan route test: each redeem action calls the trigger, `stamp` does not.
- `deliver`/render test: rendered message is at most 200 chars and ends with the link at the max template length.
- Settings schema tests (valid, empty clears, bad host, http); `saveAutomation` requires URL and `{link}`.
- `lib/reviews/stats.test.ts`: mapping and zero cases.
- SQL (no harness in repo): seeded throwaway Postgres check that `review_prompt` offers are not credited by `message_attribution` / `roi_summary`, other messages still are, and RLS hides another business's clicks.

## PRs (small, in order, stacked like D1/D2)

1. **DB:** `0031_review_prompt.sql` + types. Nothing visible changes.
2. **Link + redirect + card button:** settings field, `lib/reviews/url.ts`, `/r/[token]` route, card-page button, strings, tests. Useful on its own (permanent button + click log).
3. **Review automation:** `review_prompt` type, `triggerReviewPrompt`, scan hook, `saveAutomation` rules, automation card UI, strings, tests.
4. **Stats + copy:** invited / clicked line on the Automations card (`lib/reviews/stats.ts`), landing and plan copy.

## Verification

- Apply `0031` to a throwaway Postgres (same setup as D1/D2 PR 1), seed a business, customers, a `review_prompt` offer and clicks; check `review_clicks_summary`, the attribution exclusion, and RLS isolation.
- `pnpm --filter app typecheck` and `pnpm --filter app test`.
- Run the app: save a review link in Settings; open `/c/[token]` and click the button (should land on Google and add a `review_clicks` row); enable the review automation; redeem a reward from `/dashboard/scan`, confirm one wallet message arrives with a working link, and that redeeming again sends nothing.
- On a real iPhone and Android pass, confirm the link in the message is tappable (Apple back field assumed; Google may not be).
- Check the Automations card shows invited / clicked after a test click.

## Risks to note in the PRs

- Google Wallet messages may not make the link tappable; the card-page button is the fallback.
- A review message replaces any promo currently shown on the pass back field.
- Click counts show interest, not posted reviews.
