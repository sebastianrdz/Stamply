"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrlBase } from "@/lib/wallet/shared";
import { stripe, priceIdForPlan } from "./stripe";
import type { PlanTier } from "@/types/database";

/** Start a Stripe Checkout session to subscribe/upgrade to a paid plan. */
export async function startCheckout(tier: PlanTier) {
  const { user, membership } = await requireRole(["owner"]);
  const business = membership.business;

  const client = stripe();
  const admin = createAdminClient();

  // Ensure the business has a Stripe customer.
  let customerId = business.stripe_customer_id;
  if (!customerId) {
    const customer = await client.customers.create({
      email: user.email ?? undefined,
      name: business.name,
      metadata: { business_id: business.id },
    });
    customerId = customer.id;
    await admin
      .from("businesses")
      .update({ stripe_customer_id: customerId })
      .eq("id", business.id);
  }

  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdForPlan(tier), quantity: 1 }],
    success_url: `${appUrlBase()}/dashboard/billing?status=success`,
    cancel_url: `${appUrlBase()}/dashboard/billing?status=cancelled`,
    subscription_data: { metadata: { business_id: business.id } },
    metadata: { business_id: business.id, plan: tier },
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
