import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export interface StandaloneReward {
  id: string;
  rewardDefinitionId: string;
  type: "birthday";
  title: string;
  status: "available" | "redeemed" | "expired";
  isAvailableNow: boolean;
  grantedAt: string;
  redeemedAt: string | null;
  validUntil: string | null;
}

/**
 * Available (unredeemed, unexpired) standalone reward grants for a customer
 * at a business, newest first. Never logs customer PII — ids only, matching
 * src/lib/cards/queries.ts's convention.
 */
export async function getAvailableStandaloneRewardsForCustomer(
  supabase: Client,
  businessId: string,
  customerId: string,
): Promise<StandaloneReward[]> {
  const { data, error } = await supabase
    .from("standalone_reward_grants")
    .select("*, reward_definition:reward_definitions(type, reward_description)")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("status", "available")
    .order("granted_at", { ascending: false });
  if (error) {
    console.error(
      "[rewards/queries] getAvailableStandaloneRewardsForCustomer failed",
      { businessId, customerId, error },
    );
    throw error;
  }

  type RowWithDefinition = {
    id: string;
    reward_definition_id: string;
    status: "available" | "redeemed" | "expired";
    granted_at: string;
    redeemed_at: string | null;
    reward_definition: { type: "birthday"; reward_description: string } | null;
  };

  return ((data ?? []) as unknown as RowWithDefinition[]).map((row) => ({
    id: row.id,
    rewardDefinitionId: row.reward_definition_id,
    type: row.reward_definition?.type ?? "birthday",
    title: row.reward_definition?.reward_description ?? "",
    status: row.status,
    isAvailableNow: true,
    grantedAt: row.granted_at,
    redeemedAt: row.redeemed_at,
    validUntil: null,
  }));
}

/** The active birthday reward definition for a business, or null if none/inactive. */
export async function getBirthdayRewardDefinition(
  supabase: Client,
  businessId: string,
): Promise<{ id: string; rewardDescription: string } | null> {
  const { data, error } = await supabase
    .from("reward_definitions")
    .select("id, reward_description")
    .eq("business_id", businessId)
    .eq("type", "birthday")
    .eq("active", true)
    .maybeSingle();
  if (error) {
    console.error("[rewards/queries] getBirthdayRewardDefinition failed", {
      businessId,
      error,
    });
    throw error;
  }
  if (!data) return null;
  return { id: data.id, rewardDescription: data.reward_description };
}

/**
 * Grant a standalone reward for a customer/reward-definition/period, relying
 * on the DB's unique constraint on (customer_id, reward_definition_id,
 * period_key) as the source of truth for "already granted this period" —
 * rather than a SELECT-then-branch (see src/lib/enroll/actions.ts's customer
 * dedupe for that alternate pattern), which would leave a TOCTOU gap between
 * the check and the insert. Returns `false` (not a failure) when the
 * constraint rejects a duplicate grant; throws on any other error.
 */
export async function grantStandaloneReward(
  supabase: Client,
  params: {
    businessId: string;
    customerId: string;
    rewardDefinitionId: string;
    periodKey: string;
  },
): Promise<boolean> {
  const { error } = await supabase
    .from("standalone_reward_grants")
    .insert({
      business_id: params.businessId,
      customer_id: params.customerId,
      reward_definition_id: params.rewardDefinitionId,
      period_key: params.periodKey,
    })
    .select("id")
    .single();
  if (!error) return true;
  if (error.code === "23505") return false; // already granted this period
  console.error("[rewards/queries] grantStandaloneReward failed", {
    businessId: params.businessId,
    rewardDefinitionId: params.rewardDefinitionId,
    error,
  });
  throw error;
}
