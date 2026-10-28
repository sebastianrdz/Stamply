import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Dictionary } from "@stamply/i18n/dictionaries";
import { resolveImageField } from "@/lib/assets/upload";

type StampConfig = {
  milestones?: {
    at: number;
    reward: string;
    icon_url?: string | null;
    icon_color?: string | null;
  }[];
  reward_icon_url?: string | null;
  reward_icon_color?: string | null;
};

/**
 * Fill in the milestone and final-reward icons of a stamp config from the form
 * (`ms_icon_{i}` per milestone row, `ms_icon_final`): upload > library pick >
 * remove > keep. The client-supplied URLs in the config JSON are discarded;
 * picked URLs are validated in resolveImageField. `existing` supplies the
 * "keep" value (milestones are matched by stamp number).
 */
export async function milestoneIcons(
  supabase: SupabaseClient<Database>,
  businessId: string,
  formData: FormData,
  config: StampConfig,
  existing: Record<string, unknown> | null | undefined,
  dict: Dictionary,
): Promise<{ config: StampConfig } | { error: string }> {
  const old = (existing ?? {}) as StampConfig;
  const resolve = async (field: string, cur: string | null) => {
    const r = await resolveImageField(
      supabase,
      businessId,
      "stamp",
      formData,
      cur,
      dict,
      field,
    );
    return r === undefined ? cur : r;
  };
  try {
    const milestones = await Promise.all(
      (config.milestones ?? []).map(async (m, i) => ({
        at: m.at,
        reward: m.reward,
        icon_url: await resolve(
          `ms_icon_${i}`,
          old.milestones?.find((o) => o.at === m.at)?.icon_url ?? null,
        ),
        // Colors are plain data validated by the schema: they pass through.
        ...(m.icon_color && { icon_color: m.icon_color }),
      })),
    );
    const reward_icon_url = await resolve(
      "ms_icon_final",
      old.reward_icon_url ?? null,
    );
    return {
      config: {
        ...(milestones.length > 0 && { milestones }),
        ...(reward_icon_url && { reward_icon_url }),
        ...(config.reward_icon_color && {
          reward_icon_color: config.reward_icon_color,
        }),
      },
    };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : dict.dashboard.settings.errors.uploadFailed,
    };
  }
}
