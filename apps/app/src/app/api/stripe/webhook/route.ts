import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/billing/stripe";
import { applySubscription } from "@/lib/billing/sync";
import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServerEvent } from "@/lib/posthog/server";

/** Which Stripe event triggered `syncSubscription`, so it can decide the
 *  right PostHog subscription-lifecycle event to fire. */
type SyncSource = "created" | "updated" | "deleted" | "checkout_completed";

export const runtime = "nodejs";

async function syncSubscription(
  subscription: Stripe.Subscription,
  eventCreatedAt: Date,
  source: SyncSource,
) {
  const admin = createAdminClient();
  const result = await applySubscription(subscription, eventCreatedAt);
  if (!result) return;
  const { businessId, plan, status } = result;

  // Instrumentation only — must never break the webhook's actual sync
  // behavior (recording the dedupe row / returning 200), so the owner lookup
  // and capture are isolated in their own try/catch that logs and swallows.
  try {
    const { data: biz } = await admin
      .from("businesses")
      .select("owner_user_id")
      .eq("id", businessId)
      .single();
    const ownerUserId = biz?.owner_user_id;
    if (ownerUserId) {
      if (source === "created") {
        captureServerEvent({
          distinctId: ownerUserId,
          event: "subscription_activated",
          properties: { plan, status },
          groups: { business: businessId },
        });
      } else if (source === "updated") {
        if (status === "canceled") {
          captureServerEvent({
            distinctId: ownerUserId,
            event: "subscription_canceled",
            properties: { plan },
            groups: { business: businessId },
          });
        } else {
          captureServerEvent({
            distinctId: ownerUserId,
            event: "subscription_changed",
            properties: { plan, status },
            groups: { business: businessId },
          });
        }
      } else if (source === "deleted") {
        captureServerEvent({
          distinctId: ownerUserId,
          event: "subscription_canceled",
          properties: { plan },
          groups: { business: businessId },
        });
      }
    } else {
      console.error(
        `[stripe webhook] could not resolve owner_user_id for business ${businessId}; skipping subscription analytics event`,
      );
    }
  } catch (e) {
    console.error("[stripe webhook] subscription analytics capture failed", e);
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
        await syncSubscription(event.data.object, eventCreatedAt, "created");
        break;
      case "customer.subscription.updated":
        await syncSubscription(event.data.object, eventCreatedAt, "updated");
        break;
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object, eventCreatedAt, "deleted");
        break;
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const sub = await stripe().subscriptions.retrieve(
            session.subscription as string,
          );
          await syncSubscription(sub, eventCreatedAt, "checkout_completed");
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
