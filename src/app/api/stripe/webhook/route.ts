import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, planForPriceId } from "@/lib/billing/stripe";
import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanTier, SubscriptionStatus } from "@/types/database";

export const runtime = "nodejs";

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    default:
      return "incomplete";
  }
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  eventCreatedAt: Date,
) {
  const admin = createAdminClient();
  const businessId = subscription.metadata.business_id;
  if (!businessId) return;

  const priceId = subscription.items.data[0]?.price.id ?? "";
  const plan: PlanTier =
    subscription.status === "canceled"
      ? "trial"
      : (planForPriceId(priceId) ?? "trial");
  const status = mapStatus(subscription.status);
  const periodEnd = subscription.items.data[0]?.current_period_end;

  // The out-of-order/staleness guard lives entirely in the DB function
  // (supabase/migrations/0007_stripe_webhook_atomic_guard.sql) as an atomic
  // conditional UPDATE/UPSERT, not a read-then-write here — concurrent
  // serverless invocations for the same subscription must not be able to
  // race a read-time check.
  const { data: applied, error } = await admin.rpc(
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
      `[stripe webhook] skipped stale/out-of-order event for ${subscription.id}`,
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  const secret = requireEnv("STRIPE_WEBHOOK_SECRET", "Stripe webhook");

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      body,
      signature,
      secret,
    );
  } catch (e) {
    console.error("[stripe webhook] signature verification failed", e);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type });
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[stripe webhook] failed to record event", insertError);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  const eventCreatedAt = new Date(event.created * 1000);

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object, eventCreatedAt);
        break;
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const sub = await stripe().subscriptions.retrieve(
            session.subscription as string,
          );
          await syncSubscription(sub, eventCreatedAt);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe webhook] handler error", e);
    // Undo the dedupe record so a Stripe retry (triggered by this 500) is
    // actually reprocessed instead of being swallowed as a "duplicate" of an
    // event that never successfully finished.
    const { error: cleanupError } = await admin
      .from("stripe_webhook_events")
      .delete()
      .eq("event_id", event.id);
    if (cleanupError) {
      console.error(
        "[stripe webhook] failed to clear dedupe record after error",
        cleanupError,
      );
    }
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
