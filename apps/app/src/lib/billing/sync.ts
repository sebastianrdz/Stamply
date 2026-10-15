import "server-only";

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { planForPriceId } from "./stripe";
import type { PlanTier, SubscriptionStatus } from "@/types/database";

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "unpaid":
      return status;
    default:
      return "incomplete";
  }
}

/**
 * Apply a Stripe subscription to the business + subscriptions rows. The
 * out-of-order guard lives in the DB function
 * (supabase/migrations/0007_stripe_webhook_atomic_guard.sql) as an atomic
 * conditional UPDATE/UPSERT, so concurrent callers (webhook + the post-Checkout
 * page) can't race a read-time check. Returns the applied plan/status, or null
 * if the event was stale or the subscription has no business.
 */
export async function applySubscription(
  subscription: Stripe.Subscription,
  eventCreatedAt: Date,
): Promise<{ businessId: string; plan: PlanTier; status: SubscriptionStatus } | null> {
  const businessId = subscription.metadata.business_id;
  if (!businessId) return null;

  const priceId = subscription.items.data[0]?.price.id ?? "";
  const plan: PlanTier =
    subscription.status === "canceled"
      ? "none"
      : (planForPriceId(priceId) ?? "none");
  const status = mapStatus(subscription.status);
  const periodEnd = subscription.items.data[0]?.current_period_end;

  const { data: applied, error } = await createAdminClient().rpc(
    "sync_subscription_if_newer",
    {
      p_business_id: businessId,
      p_stripe_subscription_id: subscription.id,
      p_plan: plan,
      p_status: status,
      p_current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      p_event_created_at: eventCreatedAt.toISOString(),
    },
  );

  if (error) {
    // Let the caller's try/catch handle the 500 + dedupe-row rollback.
    throw new Error(`sync_subscription_if_newer failed: ${error.message}`);
  }
  if (!applied) {
    console.log(
      `[stripe sync] skipped stale/out-of-order event for ${subscription.id}`,
    );
    return null;
  }
  return { businessId, plan, status };
}
