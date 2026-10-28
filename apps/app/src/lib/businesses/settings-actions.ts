"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { settingsSchema } from "./settings-schema";
import type { Database } from "@/types/database";

export interface SettingsState {
  error?: string;
  ok?: boolean;
}

export async function updateBusiness(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const dict = await getDictionary(await getLocale());
  const { membership } = await requireRole(["owner", "admin"]);
  const businessId = membership.business.id;

  const schema = settingsSchema(dict.dashboard.settings.errors);

  const parsed = schema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    support_email: formData.get("support_email"),
    support_phone: formData.get("support_phone"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const update: Database["public"]["Tables"]["businesses"]["Update"] = {
    name: parsed.data.name,
    timezone: parsed.data.timezone,
    support_email: parsed.data.support_email,
    support_phone: parsed.data.support_phone,
    locale: parsed.data.locale,
  };

  const { error } = await supabase
    .from("businesses")
    .update(update)
    .eq("id", businessId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
