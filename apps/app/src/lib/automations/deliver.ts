import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWalletOffers } from "@/lib/offers/send";
import { grantStandaloneReward } from "@/lib/rewards/queries";
import { renderMessage } from "./config";
import type { Database, RewardDefinition } from "@/types/database";

export type DeliverResult = "sent" | "duplicate" | "skipped";

/**
 * Send one automation message to one customer, at most once per
 * (automation, customer, periodKey). The automation_runs row is claimed
 * first (its unique key is the idempotency guard, safe under concurrent
 * cron/inline triggers). Tradeoff: a crash between claim and push loses that
 * one message (at-most-once). The claim is released only if we fail BEFORE the
 * wallet_offers row exists (lookup/insert), so a retry can't duplicate an offer;
 * a push failure after the insert keeps the claim (the offer is on the pass). Goes through sendWalletOffers, so the
 * marketing_consent rule is the same as Broadcast. Non-birthday automations
 * also grant their optional reward under the same period (birthday grants
 * per year in the cron instead).
 */
export async function deliverAutomation(
  admin: SupabaseClient<Database>,
  def: RewardDefinition,
  customerId: string,
  periodKey: string,
  vars: Record<string, string | number>,
): Promise<DeliverResult> {
  const template = def.message?.trim();
  if (!def.active || !template) return "skipped";

  const { data: run, error } = await admin
    .from("automation_runs")
    .insert({
      business_id: def.business_id,
      automation_id: def.id,
      customer_id: customerId,
      period_key: periodKey,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw error;
  }

  try {
    if (def.reward_description && def.type !== "birthday") {
      await grantStandaloneReward(admin, {
        businessId: def.business_id,
        customerId,
        rewardDefinitionId: def.id,
        periodKey,
      });
    }
  } catch (e) {
    await admin.from("automation_runs").delete().eq("id", run.id);
    throw e;
  }
  // A throw here means the offer row exists and only the push failed: keep the claim.
  const result = await sendWalletOffers(admin, {
    businessId: def.business_id,
    body: renderMessage(template, vars),
    customerIds: [customerId],
    automationId: def.id,
  });
  if (!result.ok) {
    // Not opted in (or gone): nothing to retry, keep the claim.
    if (result.reason === "noRecipients" || result.reason === "notOptedIn")
      return "skipped";
    // lookup/insert failed before any offer existed: safe to retry later.
    await admin.from("automation_runs").delete().eq("id", run.id);
    throw new Error(result.reason);
  }
  return "sent";
}
