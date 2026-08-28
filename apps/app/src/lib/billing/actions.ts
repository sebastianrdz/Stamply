"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServerEvent } from "@/lib/posthog/server";
import { appUrlBase } from "@/lib/wallet/shared";
import { stripe, priceIdForPlan } from "./stripe";
import type { BillingInterval } from "@stamply/plans";
import type { Business, PlanTier } from "@/types/database";

/**
 * Terminal Stripe subscription statuses: the billing relationship is over and
 * the subscription can no longer be modified by the Customer Portal, so a
 * fresh Checkout session is the only way forward from one of these.
 */
const TERMINAL_SUBSCRIPTION_STATUSES: ReadonlySet<Stripe.Subscription.Status> =
  new Set(["canceled", "incomplete_expired"]);

/**
 * A subscription is "live" — money is moving on it, or about to — unless it's
 * in a terminal state. We treat *everything* non-terminal as live on purpose,
 * rather than allow-listing a few statuses: `active`, `trialing`, `past_due`,
 * `unpaid`, `paused`, and crucially `incomplete` (first invoice not yet
 * settled — card 3DS, or delayed ACH/SEPA that can take days) all represent a
 * subscription that could still bill or resume. Starting a *second* Checkout
 * on top of any of them would double-charge the business, so every non-terminal
 * subscription must route through a Portal plan-change instead. If the Portal
 * can't update a still-`incomplete` sub the owner sees an error — the correct,
 * safe-by-default outcome (no money lost) rather than a silent double charge.
 */
function isLiveSubscription(status: Stripe.Subscription.Status): boolean {
  return !TERMINAL_SUBSCRIPTION_STATUSES.has(status);
}

/**
 * Ensure the business has a Stripe customer, persisting the id back to the
 * `businesses` row. If the persist fails we throw rather than continuing —
 * silently swallowing the error would orphan the Stripe customer (it's not
 * linked to the business anywhere) and mint a duplicate customer on the
 * next attempt, since `business.stripe_customer_id` would still read null.
 *
 * Before creating a new customer we look one up by `metadata.business_id`
 * to self-heal exactly that scenario: a prior `customers.create` that
 * succeeded but whose DB persist failed.
 */
async function ensureStripeCustomer(
  client: Stripe,
  admin: ReturnType<typeof createAdminClient>,
  business: Pick<Business, "id" | "name" | "stripe_customer_id">,
  userEmail: string | undefined,
): Promise<string> {
  if (business.stripe_customer_id) return business.stripe_customer_id;

  let customerId: string | undefined;
  try {
    const found = await client.customers.search({
      query: `metadata['business_id']:'${business.id}'`,
      limit: 1,
    });
    customerId = found.data[0]?.id;
  } catch (e) {
    // Search is best-effort self-healing, not required for correctness.
    console.error(
      "[billing] customer metadata search failed, creating a new customer",
      e,
    );
  }

  if (!customerId) {
    const customer = await client.customers.create({
      email: userEmail,
      name: business.name,
      metadata: { business_id: business.id },
    });
    customerId = customer.id;
  }

  const { error } = await admin
    .from("businesses")
    .update({ stripe_customer_id: customerId })
    .eq("id", business.id);
  if (error) {
    throw new Error(
      `Failed to save Stripe customer for business ${business.id}: ${error.message}`,
    );
  }

  return customerId;
}

/**
 * Find the customer's "live" subscription, if any — see
 * {@link LIVE_SUBSCRIPTION_STATUSES}. This is the source of truth for
 * whether a plan change may create a new subscription (never, if one is
 * live) or must instead modify the existing one. Queries Stripe directly
 * rather than the local `subscriptions` table, which is only updated
 * asynchronously by the webhook and can be stale.
 */
async function findLiveSubscription(
  client: Stripe,
  customerId: string,
): Promise<Stripe.Subscription | null> {
  const subscriptions = await client.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  return (
    subscriptions.data.find((sub) => isLiveSubscription(sub.status)) ?? null
  );
}

/**
 * Change the business's plan.
 *
 * Core invariant: a business with a live Stripe subscription must never
 * end up with a second one. We determine "live" from Stripe itself (not the
 * local `subscriptions` table) and branch:
 *  - Live subscription exists → open a Billing Portal session deep-linked
 *    into the plan-change confirmation flow for that subscription. Stripe
 *    updates the single existing subscription with proration; no Checkout
 *    session is created.
 *  - No live subscription (never subscribed, trial, or fully canceled) →
 *    create a Checkout session, same as before. A canceled subscription
 *    can't be updated by the Portal, so this is also the correct path for
 *    reactivation.
 */
export async function changePlan(
  tier: PlanTier,
  interval: BillingInterval = "month",
) {
  const { user, membership } = await requireRole(["owner"]);
  const business = membership.business;

  const client = stripe();
  const admin = createAdminClient();

  const customerId = await ensureStripeCustomer(
    client,
    admin,
    business,
    user.email ?? undefined,
  );

  const liveSubscription = await findLiveSubscription(client, customerId);

  if (liveSubscription) {
    const item = liveSubscription.items.data[0];
    if (!item) {
      throw new Error(
        `Subscription ${liveSubscription.id} has no items to update.`,
      );
    }

    const targetPrice = priceIdForPlan(tier, interval);

    // The billing page disables the current tier, but `businesses.plan` is
    // updated only asynchronously by the webhook — so right after a switch an
    // owner can still see (and click) the tier the subscription is already on.
    // Short-circuit that no-op instead of sending a same-price update to
    // Stripe, which would error.
    if (item.price.id === targetPrice) {
      redirect(`${appUrlBase()}/dashboard/billing?status=nochange`);
      return;
    }

    const portalSession = await client.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrlBase()}/dashboard/billing?status=success`,
      flow_data: {
        type: "subscription_update_confirm",
        subscription_update_confirm: {
          subscription: liveSubscription.id,
          items: [{ id: item.id, price: targetPrice, quantity: 1 }],
        },
      },
    });
    redirect(portalSession.url);
    return;
  }

  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdForPlan(tier, interval), quantity: 1 }],
    // Show the "Add promotion code" field on the Checkout page (Stripe hides it
    // by default). Codes must also exist as live Promotion Codes in Stripe.
    allow_promotion_codes: true,
    success_url: `${appUrlBase()}/dashboard/billing?status=success`,
    cancel_url: `${appUrlBase()}/dashboard/billing?status=cancelled`,
    subscription_data: { metadata: { business_id: business.id } },
    metadata: { business_id: business.id, plan: tier },
  });

  captureServerEvent({
    distinctId: user.id,
    event: "checkout_started",
    properties: { tier, interval },
    groups: { business: business.id },
  });

  if (session.url) redirect(session.url);
}

/** Open the Stripe Customer Portal to manage/cancel the subscription. */
export async function openBillingPortal() {
  const { membership } = await requireRole(["owner"]);
  const business = membership.business;
  if (!business.stripe_customer_id) redirect("/dashboard/billing");

  const session = await stripe().billingPortal.sessions.create({
    customer: business.stripe_customer_id,
    return_url: `${appUrlBase()}/dashboard/billing`,
  });
  redirect(session.url);
}
