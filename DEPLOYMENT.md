# Stamply — Production Deployment Runbook

Target: **stamplycards.com** (marketing, apex) + **app.stamplycards.com** (the app).
Hosting: **Vercel Hobby (free)**, two projects from this one monorepo.
Backend: **two free Supabase projects** — `stamply-prod` and `stamply-staging`.
Billing: **Stripe live** (production only; staging uses Stripe test mode).

> ⚠️ **The app host is permanent.** Apple Wallet passes bake
> `https://app.stamplycards.com/api/apple/v1` into every pass, and all QR /
> enrollment / Stripe / wallet URLs derive from `NEXT_PUBLIC_APP_URL`
> (`apps/app/src/lib/urls.ts`, `env.ts`, `wallet/shared.ts`). **Do not distribute
> real passes until `app.stamplycards.com` is live** (Stage 6). Test passes on
> `*.vercel.app` are disposable.

> ℹ️ Vercel Hobby is non-commercial per Vercel's ToS — fine for setup/testing,
> upgrade to Pro before charging real customers. Supabase Branching and Vercel
> Custom Environments are paid; this runbook avoids both (two free projects +
> free Preview Deployments instead).

---

## Stage 1 — Vercel projects (deploy to `*.vercel.app` first)

Create **two** projects, both importing this GitHub repo, Production Branch `main`:

| Setting | app project | marketing project |
|---|---|---|
| Project name | `stamply-app` | `stamply-marketing` |
| Root Directory | `apps/app` | `apps/marketing` |
| Framework preset | Next.js | Next.js |
| Node.js version | 20.x | 20.x |
| Build / Install / Output | defaults | defaults |

- With Root Directory set, Vercel keeps "Include files outside the Root Directory" **on** (needed for the sibling `packages/*` + root lockfile) — leave it on.
- `next build` does **not** require env vars (verified in CI), so both will deploy green now. They just won't *function* until env + backend are set.
- Grab the two `*.vercel.app` URLs — you'll smoke-test on them before attaching the domain.

**Optional (save build minutes):** set each project's *Settings → Git → Ignored Build Step* to
`bash scripts/vercel-ignore.sh apps/app` (app) / `bash scripts/vercel-ignore.sh apps/marketing` (marketing).

---

## Stage 2 — Supabase (two free projects)

Do this for **`stamply-prod`** first (repeat the DB steps for `stamply-staging`).

1. Create the project. Copy from *Settings → API*: **Project URL**, **anon public key**, **service_role key** (secret).
2. Apply migrations `0001 → 0014` (run from `apps/app`, where `supabase/` lives):
   ```bash
   cd apps/app
   supabase login                      # once
   supabase link --project-ref <PROJECT_REF>
   supabase db push                    # applies supabase/migrations in order
   ```
   (No CLI? Paste each file in `apps/app/supabase/migrations/*.sql` into the SQL Editor **in numeric order**.)
3. **Storage** → New bucket → name **`business-assets`**, **Public** = on. (Logos, backgrounds, Google Wallet hero images depend on it.)
4. **Authentication → URL Configuration**:
   - prod: Site URL `https://app.stamplycards.com`, add redirect `https://app.stamplycards.com/**`
   - staging: Site URL = the app's staging URL (its `*.vercel.app` or a `staging.` subdomain), redirect `<that>/**`
   - Auth is email/password only. **Turn "Confirm email" ON** for both projects — the app now sends its own branded confirmation email via Resend (Stage 4.5) and handles the click-through at `/auth/confirm`, so there's no need to leave confirmation off anymore.
5. `pg_cron` (for migration `0014`'s prune job) is available on free Supabase; the migration self-enables it and no-ops safely if it's ever missing. Verify under *Database → Extensions* that `pg_cron` is enabled.

---

## Stage 3 — Stripe (live)

1. Activate the account for live mode (business details + bank).
2. Create **live** Products/Prices for Small / Medium / Big → copy the three price IDs.
3. Copy the **live secret key**.
4. *Developers → Webhooks* → add endpoint `https://app.stamplycards.com/api/stripe/webhook`, events:
   `checkout.session.completed`, `customer.subscription.created`, `.updated`, `.deleted` → copy the **live signing secret**.
5. Staging: repeat in **test mode** (test keys/prices, webhook at the staging app URL).

---

## Stage 4 — Wallet credentials (base64 → env)

The app reads certs from env (never the filesystem). Base64-encode each and paste as the matching var (macOS: `base64 -i <file> | pbcopy`):

| Var | Source |
|---|---|
| `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID` | Apple Developer |
| `APPLE_PASS_CERT_BASE64` | Pass Type ID cert (`.p12` or `.pem`) |
| `APPLE_PASS_KEY_BASE64`, `APPLE_PASS_CERT_PASSWORD` | pass private key + its password |
| `APPLE_WWDR_CERT_BASE64` | Apple WWDR cert |
| `APPLE_APNS_KEY_BASE64`, `APPLE_APNS_KEY_ID` | APNs auth key (`.p8`) + key id |
| `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_EMAIL`, `GOOGLE_WALLET_SA_KEY_BASE64` | Google Wallet issuer + service-account JSON key |

> **Lead time:** a new Google Wallet LoyaltyClass ships `UNDER_REVIEW` — request production/publishing approval in the Google Wallet console early (business verification can take days).

---

## Stage 4.5 — Email (Resend + `mail.stamplycards.com`)

Transactional email (team invites, signup confirmation, password reset) is sent via [Resend](https://resend.com), fully custom-built with React Email templates — not Supabase's built-in SMTP/template system. Do this once; both prod and staging share the same Resend domain/key (Preview scope just points at the same sending domain).

1. **Resend dashboard** → Domains → Add `mail.stamplycards.com` — an isolated subdomain, so email infrastructure never risks the apex/app domains' deliverability or DNS. Resend generates MX / SPF (TXT) / DKIM (CNAME) records (and optionally a DMARC TXT at `_dmarc.mail.stamplycards.com`, starting with `v=DMARC1; p=none;`).
2. **Vercel dashboard** → `stamplycards.com` project → Domains → DNS Records → add each record exactly as Resend shows it. Vercel is registrar + DNS host already (Stage 6), so this is the only place records need to go — no external nameservers.
3. Back in Resend, click **Verify** — wait for all records to go green before sending real mail.
4. Resend → API Keys → create a **sending-only** scoped key → this is `RESEND_API_KEY`.
5. Pick a from-address once the domain is verified, e.g. `notifications@mail.stamplycards.com` → this is `EMAIL_FROM_ADDRESS`. Set the **bare address only** (no display name) — the app validates it as an email and adds the "Stamply <...>" display name itself when sending.
6. Add both vars to Vercel (Stage 5) and redeploy `stamply-app`.
7. Confirm Stage 2.4's "Confirm email" is **ON** in Supabase — required for the new `/auth/confirm` verification flow to have something to verify.

---

## Stage 5 — Environment variables (per project)

Set in *Settings → Environment Variables*. Use the **Production** scope for prod values and the **Preview** scope for staging values (Preview = every non-main branch, your free staging).

### `stamply-app`
**Production scope** → point at **stamply-prod** + Stripe live:
```
NEXT_PUBLIC_APP_URL=https://app.stamplycards.com
NEXT_PUBLIC_MARKETING_URL=https://stamplycards.com
NEXT_PUBLIC_SUPABASE_URL=<prod project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod anon>
SUPABASE_SERVICE_ROLE_KEY=<prod service_role>              # secret
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET                  # live
STRIPE_PRICE_SMALL / STRIPE_PRICE_MEDIUM / STRIPE_PRICE_BIG
APPLE_PASS_TYPE_ID / APPLE_TEAM_ID / APPLE_PASS_CERT_BASE64 / APPLE_PASS_KEY_BASE64
APPLE_PASS_CERT_PASSWORD / APPLE_WWDR_CERT_BASE64 / APPLE_APNS_KEY_BASE64 / APPLE_APNS_KEY_ID
GOOGLE_WALLET_ISSUER_ID / GOOGLE_WALLET_SA_EMAIL / GOOGLE_WALLET_SA_KEY_BASE64
RESEND_API_KEY / EMAIL_FROM_ADDRESS                        # Stage 4.5
# optional — shared rate limiting; without it, falls back to in-memory:
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
```
**Preview scope** → same var names but **stamply-staging** Supabase + **Stripe test** keys; set `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_MARKETING_URL` to the staging URLs.

### `stamply-marketing`
**Production scope** (no secrets):
```
NEXT_PUBLIC_MARKETING_URL=https://stamplycards.com
NEXT_PUBLIC_APP_URL=https://app.stamplycards.com
```
**Preview scope**: the staging equivalents.

Redeploy both projects after setting env (env changes don't auto-redeploy).

---

## Stage 6 — Domain (buy in Vercel, then assign + lock)

1. Buy **stamplycards.com** in Vercel (*Domains*). Vercel becomes the registrar + DNS — no external nameserver setup.
2. *stamply-marketing* → Domains → add **`stamplycards.com`** and **`www.stamplycards.com`** (www = redirect to apex).
3. *stamply-app* → Domains → add **`app.stamplycards.com`**. Vercel auto-creates the DNS records + TLS for both.
4. Confirm `NEXT_PUBLIC_APP_URL=https://app.stamplycards.com` in prod (Stage 5) and redeploy. **App host is now locked.**
5. Future subdomains (e.g. `mail.` for email/DKIM, added in Stage 4.5) are one record each in the same Vercel DNS zone.

---

## Stage 7 — Point everything at the final app URL

- **Supabase (prod)**: Site URL + redirect = `https://app.stamplycards.com/**` (Stage 2.4, confirm).
- **Stripe (live)**: webhook endpoint = `https://app.stamplycards.com/api/stripe/webhook` (Stage 3.4, confirm) → `STRIPE_WEBHOOK_SECRET` matches.
- **Apple**: pass web-service is `https://app.stamplycards.com/api/apple/v1` (automatic via `NEXT_PUBLIC_APP_URL`; requires HTTPS — Vercel provides it).
- **Google Wallet**: JWT `origins` = `https://app.stamplycards.com` (automatic); ensure the LoyaltyClass is approved/published.

---

## Stage 8 — Smoke test (on the real domains) → then go live

- **Marketing**: `https://stamplycards.com` renders; `www` → apex; `/sitemap.xml` + `/robots.txt` valid; OG image renders (X/Facebook debugger); ES/EN toggle; "Get started" → `app.stamplycards.com/register`.
- **App auth**: register → onboarding → dashboard; logged-out `/dashboard` → `/login`.
- **Billing**: live checkout (small real card, then refund) → webhook flips plan → billing page shows active; portal works.
- **Enroll/QR**: program QR → `/c/join/[programId]` → `/c/[token]` card.
- **Apple pass**: add on a real iPhone; stamp in dashboard → APNs pushes the update live.
- **Google pass**: "Add to Google Wallet" once the class is approved.
- App subdomain not indexed (robots disallow-all); marketing indexes.

Only after the pass tests pass on `app.stamplycards.com` should real customer passes go out.

---

## Staging workflow (free)

- `main` → Production (both projects). Any other branch / PR → **Preview** deploy (free) = your staging.
- Preview-scope env vars point at **stamply-staging** Supabase + **Stripe test**, so previews never touch prod data or real billing.
- A long-lived `development` or `staging` branch gives a stable-ish preview to test against before merging to `main`.
