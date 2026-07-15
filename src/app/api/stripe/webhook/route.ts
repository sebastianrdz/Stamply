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

async function syncSubscription(subscription: Stripe.Subscription) {
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

  await admin
    .from("businesses")
    .update({ plan, subscription_status: status })
    .eq("id", businessId);

  await admin.from("subscriptions").upsert(
    {
      business_id: businessId,
      stripe_subscription_id: subscription.id,
      plan,
      status,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    },
    { onConflict: "stripe_subscription_id" },
  );
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

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const sub = await stripe().subscriptions.retrieve(
            session.subscription as string,
          );
          await syncSubscription(sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe webhook] handler error", e);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
