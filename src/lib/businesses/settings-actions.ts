"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB color.");

const schema = z.object({
  name: z.string().min(2, "Name is required.").max(80),
  brand_primary_color: hex,
  brand_secondary_color: hex,
  logo_url: z.string().url("Enter a valid URL.").optional().or(z.literal("")),
  timezone: z.string().min(1).max(64),
});

export interface SettingsState {
  error?: string;
  ok?: boolean;
}

export async function updateBusiness(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { membership } = await requireBusiness();

  const parsed = schema.safeParse({
    name: formData.get("name"),
    brand_primary_color: formData.get("brand_primary_color"),
    brand_secondary_color: formData.get("brand_secondary_color"),
    logo_url: formData.get("logo_url"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      name: parsed.data.name,
      brand_primary_color: parsed.data.brand_primary_color,
      brand_secondary_color: parsed.data.brand_secondary_color,
      logo_url: parsed.data.logo_url || null,
      timezone: parsed.data.timezone,
    })
    .eq("id", membership.business.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
