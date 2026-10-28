"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/posthog/server";
import { AUTOMATION_TYPES, CONFIG_FIELDS } from "@/lib/automations/config";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import type { RewardType } from "@/types/database";

export interface AutomationFormState {
  error?: string;
  saved?: boolean;
}

/** Create or update one automation (a reward_definitions row) of this business. */
export async function saveAutomation(
  _prev: AutomationFormState,
  formData: FormData,
): Promise<AutomationFormState> {
  const { user, membership } = await requireRole(["owner", "admin"]);
  const business = membership.business;
  const dict = await getDictionary(await getLocale());

  const parsed = z
    .object({
      type: z.enum(AUTOMATION_TYPES as [RewardType, ...RewardType[]]),
      active: z.union([z.literal("on"), z.null()]).transform((v) => v === "on"),
      message: z.string().trim().max(200),
      reward_description: z.string().trim().max(200),
      setting: z.coerce.number().int().optional(),
    })
    .safeParse({
      type: formData.get("type"),
      active: formData.get("active"),
      message: formData.get("message") ?? "",
      reward_description: formData.get("reward_description") ?? "",
      setting: formData.get("setting") ?? undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { type, active, message, reward_description, setting } = parsed.data;
  if (active && !message) {
    return { error: dict.dashboard.rewards.errors.messageRequired };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("reward_definitions")
    .select("id, config")
    .eq("business_id", business.id)
    .eq("type", type)
    .maybeSingle();

  const config = { ...(existing?.config ?? {}) } as Record<string, unknown>;
  const field = CONFIG_FIELDS[type];
  if (field && setting !== undefined) {
    if (setting < field.min || setting > field.max) {
      return { error: dict.dashboard.rewards.errors.settingRange };
    }
    config[field.key] = setting;
  }

  const row = {
    active,
    message: message || null,
    reward_description: reward_description || null,
    config,
  };
  const { error } = existing
    ? await supabase
        .from("reward_definitions")
        .update(row)
        .eq("id", existing.id)
        .eq("business_id", business.id)
    : await supabase
        .from("reward_definitions")
        .insert({ business_id: business.id, type, ...row });
  if (error) return { error: error.message };

  captureServerEvent({
    distinctId: user.id,
    event: "reward_definition_saved",
    properties: { reward_type: type, active },
    groups: { business: business.id },
  });

  revalidatePath("/dashboard/automations");
  return { saved: true };
}
