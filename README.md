# Stamply

Digital loyalty cards for cafés, barbershops, and restaurants — in **Apple Wallet**,
**Google Wallet**, and the web. Businesses sign up, create loyalty programs, and staff
scan a customer's QR (right in the browser) to add stamps or redeem rewards.

Built with **Next.js 16 (App Router) · Supabase (Postgres + RLS) · Stripe · Tailwind 4**.

## Features

- **Multi-tenant** businesses with owner/admin/employee roles, enforced by Supabase RLS.
- **Loyalty programs** — stamp cards or points, with a configurable goal and reward.
- **Customer enrollment** via an in-store QR → short form (name, email, phone, marketing
  consent) → issues a card and offers Add-to-Wallet.
- **Apple Wallet** signed `.pkpass` + full PassKit web service (device registration, pass
  updates) + APNs push on changes.
- **Google Wallet** LoyaltyClass/Object + signed "Save to Google Wallet" JWT + live PATCH
  updates.
- **In-browser QR scanning** for staff to stamp / redeem, with a double-scan cooldown.
- **Proximity relevance** — store locations attach to passes so cards surface on the lock
  screen when a customer is nearby (no customer app required).
- **Tiered billing** with Stripe — Small $399, Medium $699, Big $1299/mo — with per-plan
  limits (locations, employees, customers, programs) enforced on create.
- Dashboard with overview, analytics, customers, locations, billing, and branding settings.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in the values below
pnpm dev
```

### 1. Supabase

Create a project, then run the migrations in `supabase/migrations/` (via the Supabase SQL
editor or `supabase db push`). Set:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; used for enrollment, wallet callbacks, webhooks)

### 2. Stripe

Create three recurring prices and a webhook (`/api/stripe/webhook`) subscribed to
`checkout.session.completed` and `customer.subscription.*`. Set `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SMALL|MEDIUM|BIG`.

### 3. Apple Wallet

- Apple Developer: create a **Pass Type ID** + certificate; download the **WWDR** cert; make
  an **APNs Auth Key (.p8)**.
- Export the pass cert & key as PEM and base64-encode them. Set `APPLE_PASS_TYPE_ID`,
  `APPLE_TEAM_ID`, `APPLE_PASS_CERT_BASE64`, `APPLE_PASS_KEY_BASE64`,
  `APPLE_PASS_CERT_PASSWORD`, `APPLE_WWDR_CERT_BASE64`, `APPLE_APNS_KEY_BASE64`,
  `APPLE_APNS_KEY_ID`.

### 4. Google Wallet

- Google Cloud: enable the **Google Wallet API**, create a **service account** key, and get
  your **Issuer ID**. Set `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_EMAIL`,
  `GOOGLE_WALLET_SA_KEY_BASE64` (base64 of the service-account private key).

> Wallet + billing features degrade gracefully: the app boots and the core flows work before
> these are provisioned; the relevant routes return a 503 until their credentials are set.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier write |

## Architecture

```
src/
  app/
    (auth)/                 login / register
    onboarding/             create first business
    dashboard/              business app (overview, scan, programs, customers,
                            locations, analytics, billing, settings)
    c/join/[programId]/     public enrollment
    c/[token]/              public web card view + Add to Wallet
    api/
      scan/                 stamp / redeem
      wallet/apple|google/  pass generation
      apple/v1/…            Apple PassKit web service callbacks
      stripe/webhook/       subscription sync
  lib/
    supabase/               browser / server / admin clients
    wallet/apple|google/    pass signing, APNs, JWT, class/object
    billing/                plans, entitlements, Stripe
    cards/, programs/, enroll/, locations/, auth/
  components/               UI primitives + dashboard components
  types/database.ts         hand-maintained Supabase types
supabase/migrations/        schema, RLS, atomic stamp/redeem functions
```

Tenant isolation is enforced by RLS (`auth_business_ids()` / `is_business_admin()`).
Customer-facing and wallet-callback paths run through the service-role client on the server
only.
