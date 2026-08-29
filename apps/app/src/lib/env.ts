import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Core vars (Supabase, app URL) are required; feature
 * secrets (Stripe, Apple/Google Wallet) are optional so the app can boot and be
 * developed before every integration is provisioned. Use `requireEnv` when a
 * feature actually needs one, to fail loudly with a clear message.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_SMALL: z.string().optional(),
  STRIPE_PRICE_MEDIUM: z.string().optional(),
  STRIPE_PRICE_BIG: z.string().optional(),
  // Annual (yearly recurring) Stripe price ids — 2 months free vs monthly.
  STRIPE_PRICE_SMALL_ANNUAL: z.string().optional(),
  STRIPE_PRICE_MEDIUM_ANNUAL: z.string().optional(),
  STRIPE_PRICE_BIG_ANNUAL: z.string().optional(),

  // Apple Wallet (PassKit) — certs/keys stored base64-encoded.
  APPLE_PASS_TYPE_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_PASS_CERT_BASE64: z.string().optional(),
  APPLE_PASS_KEY_BASE64: z.string().optional(),
  APPLE_PASS_CERT_PASSWORD: z.string().optional(),
  APPLE_WWDR_CERT_BASE64: z.string().optional(),
  APPLE_APNS_KEY_BASE64: z.string().optional(),
  APPLE_APNS_KEY_ID: z.string().optional(),

  // Google Wallet
  GOOGLE_WALLET_ISSUER_ID: z.string().optional(),
  GOOGLE_WALLET_SA_EMAIL: z.string().optional(),
  GOOGLE_WALLET_SA_KEY_BASE64: z.string().optional(),

  // Upstash Redis — enables the Redis-backed rate limiter (shared across
  // instances) when both are set; optional, falls back to an in-memory
  // limiter when either is unset.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Resend — transactional email (team invites, verification, password reset).
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),

  // PostHog (US Cloud). Same public project key serves posthog-js and
  // posthog-node. NEXT_PUBLIC_POSTHOG_HOST is a relative path proxied through
  // this app's own domain (see next.config.ts); POSTHOG_HOST is the real US
  // ingestion endpoint used for direct server-to-server capture.
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().default("/ingest"), // relative — no .url()
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),

  // Cron auth — protects internal cron-triggered routes from public invocation.
  CRON_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Require an optional env var for a specific feature; throws with context. */
export function requireEnv<K extends keyof ServerEnv>(
  key: K,
  feature: string,
): NonNullable<ServerEnv[K]> {
  const value = serverEnv()[key];
  if (value == null || value === "") {
    throw new Error(
      `Missing ${String(key)} — required for ${feature}. Set it in your environment.`,
    );
  }
  return value as NonNullable<ServerEnv[K]>;
}

/** Decode a base64-encoded secret (certs/keys) into a Buffer. */
export function decodeBase64Env<K extends keyof ServerEnv>(
  key: K,
  feature: string,
): Buffer {
  return Buffer.from(requireEnv(key, feature) as string, "base64");
}
