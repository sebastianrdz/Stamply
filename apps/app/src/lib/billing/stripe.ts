import "server-only";

import Stripe from "stripe";
import { requireEnv } from "@/lib/env";
import { PLANS, type BillingInterval } from "@stamply/plans";
import type { PlanTier } from "@/types/database";

let stripeClient: Stripe | null = null;

export function stripe(): Stripe {
  if (stripeClient) return stripeClient;
  stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY", "Stripe billing"));
  return stripeClient;
}

/** Resolve the configured Stripe price id for a paid plan + billing interval. */
export function priceIdForPlan(
  tier: PlanTier,
  interval: BillingInterval = "month",
): string {
  const def = PLANS[tier];
  const envKey =
    interval === "year" ? def.stripePriceEnvAnnual : def.stripePriceEnv;
  if (!envKey) {
    throw new Error(`Plan ${tier} has no ${interval}ly Stripe price.`);
  }
  return requireEnv(envKey, `Stripe ${interval}ly price for ${tier}`);
}

/** Map a Stripe price id back to a plan tier (matches either interval). */
export function planForPriceId(priceId: string): PlanTier | null {
  for (const def of Object.values(PLANS)) {
    for (const envKey of [def.stripePriceEnv, def.stripePriceEnvAnnual]) {
      if (envKey && process.env[envKey] === priceId) return def.tier;
    }
  }
  return null;
}

// Terminal statuses (mirrors findLiveSubscription in actions.ts): a
// subscription in one of these is over and isn't the customer's current plan.
const TERMINAL_STATUSES = new Set<string>(["canceled", "incomplete_expired"]);

/**
 * Best-effort billing interval of the customer's current (live) subscription,
 * for display only. Returns null if there's no live subscription or on any
 * Stripe error — callers must treat null as "unknown", never as an error.
 */
export async function currentBillingInterval(
  customerId: string,
): Promise<BillingInterval | null> {
  try {
    const { data } = await stripe().subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
    const live = data.find((s) => !TERMINAL_STATUSES.has(s.status));
    const interval = live?.items.data[0]?.price.recurring?.interval;
    return interval === "year" || interval === "month" ? interval : null;
  } catch (e) {
    console.error("[billing] currentBillingInterval failed", e);
    return null;
  }
}
