import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RewardDefinition, RewardType } from "@/types/database";
import { almostThere } from "./dates";
import { configNumber } from "./config";
import { deliverAutomation } from "./deliver";
import { errInfo } from "./log";

type Admin = SupabaseClient<Database>;

async function activeAutomation(
  admin: Admin,
  businessId: string,
  type: RewardType,
): Promise<RewardDefinition | null> {
  const { data } = await admin
    .from("reward_definitions")
    .select("*")
    .eq("business_id", businessId)
    .eq("type", type)
    .eq("active", true)
    .maybeSingle();
  return (data as RewardDefinition | null) ?? null;
}

const firstName = (full: string | null) => (full ?? "").trim().split(/\s+/)[0];

/**
 * Inline triggers. They NEVER throw: the enroll/scan response must not depend
 * on them. Errors are logged with ids/codes only, no customer data.
 */
export async function triggerWelcome(
  admin: Admin,
  params: { businessId: string; customerId: string },
): Promise<void> {
  try {
    const def = await activeAutomation(admin, params.businessId, "welcome");
    if (!def) return;
    const [{ data: customer }, { data: business }] = await Promise.all([
      admin
        .from("customers")
        .select("full_name")
        .eq("id", params.customerId)
        .single(),
      admin.from("businesses").select("name").eq("id", params.businessId).single(),
    ]);
    if (!customer || !business) return;
    await deliverAutomation(admin, def, params.customerId, "once", {
      name: firstName(customer.full_name),
      business: business.name,
    });
  } catch (e) {
    console.error("[automations] welcome failed", {
      businessId: params.businessId,
      ...errInfo(e),
    });
  }
}

export async function triggerAlmostThere(
  admin: Admin,
  card: {
    id: string;
    business_id: string;
    customer_id: string;
    stamps: number;
    program: { type: string; goal: number };
    business: { name: string };
    customer: { full_name: string | null };
  },
): Promise<void> {
  try {
    if (card.program.type !== "stamp") return;
    const def = await activeAutomation(admin, card.business_id, "almost_there");
    if (!def) return;
    const hit = almostThere(
      card.stamps,
      card.program.goal,
      configNumber("almost_there", def.config),
    );
    if (!hit) return;
    await deliverAutomation(
      admin,
      def,
      card.customer_id,
      `${card.id}:${hit.cycle}`,
      {
        name: firstName(card.customer.full_name),
        business: card.business.name,
        remaining: hit.left,
      },
    );
  } catch (e) {
    console.error("[automations] almost_there failed", {
      businessId: card.business_id,
      cardId: card.id,
      ...errInfo(e),
    });
  }
}
