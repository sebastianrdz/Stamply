import "server-only";

import Stripe from "stripe";
import { requireEnv } from "@/lib/env";
import { PLANS } from "./plans";
import type { PlanTier } from "@/types/database";

let stripeClient: Stripe | null = null;

export function stripe(): Stripe {
  if (stripeClient) return stripeClient;
  stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY", "Stripe billing"));
  return stripeClient;
}

/** Resolve the configured Stripe price id for a paid plan. */
export function priceIdForPlan(tier: PlanTier): string {
  const def = PLANS[tier];
  if (!def.stripePriceEnv) {
    throw new Error(`Plan ${tier} has no Stripe price.`);
  }
  return requireEnv(def.stripePriceEnv, `Stripe price for ${tier}`);
}

/** Map a Stripe price id back to a plan tier. */
export function planForPriceId(priceId: string): PlanTier | null {
  for (const def of Object.values(PLANS)) {
    if (!def.stripePriceEnv) continue;
    if (process.env[def.stripePriceEnv] === priceId) return def.tier;
  }
  return null;
}
