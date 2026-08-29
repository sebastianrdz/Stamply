"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/posthog/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary, type Dictionary } from "@stamply/i18n/dictionaries";

export interface RewardDefinitionFormState {
  error?: string;
}

/**
 * `dict.dashboard.rewards.*` is out of scope here (a sibling frontend
 * package owns those keys and will add them later) — reusing
 * `dashboard.programs.errors.rewardRequired` ("Describe the reward." /
 * "Describe la recompensa.") since it's semantically the same validation as
 * the reward-description field on this form, rather than adding a new
 * `dashboard.rewards.*` key myself.
 */
function rewardDefinitionSchema(dict: Dictionary) {
  return z.object({
    reward_description: z
      .string()
      .min(2, dict.dashboard.programs.errors.rewardRequired)
      .max(200),
    active: z.union([z.literal("on"), z.null()]).transform((v) => v === "on"),
  });
}

export async function upsertRewardDefinition(
  _prev: RewardDefinitionFormState,
  formData: FormData,
): Promise<RewardDefinitionFormState> {
  const { user, membership } = await requireRole(["owner", "admin"]);
  const business = membership.business;
  const dict = await getDictionary(await getLocale());

  const parsed = rewardDefinitionSchema(dict).safeParse({
    reward_description: formData.get("reward_description"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("reward_definitions")
    .select("id")
    .eq("business_id", business.id)
    .eq("type", "birthday")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("reward_definitions")
      .update({
        reward_description: parsed.data.reward_description,
        active: parsed.data.active,
      })
      .eq("id", existing.id)
      .eq("business_id", business.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("reward_definitions").insert({
      business_id: business.id,
      type: "birthday",
      reward_description: parsed.data.reward_description,
      active: parsed.data.active,
      config: {},
    });
    if (error) return { error: error.message };
  }

  captureServerEvent({
    distinctId: user.id,
    event: "reward_definition_saved",
    properties: {
      reward_type: "birthday",
      active: parsed.data.active,
    },
    groups: { business: business.id },
  });

  revalidatePath("/dashboard/rewards");
  return {};
}

export async function toggleRewardDefinitionActive(
  id: string,
  active: boolean,
): Promise<void> {
  const { membership } = await requireRole(["owner", "admin"]);
  const supabase = await createClient();
  await supabase
    .from("reward_definitions")
    .update({ active })
    .eq("id", id)
    .eq("business_id", membership.business.id);

  revalidatePath("/dashboard/rewards");
}
