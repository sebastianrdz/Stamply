"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const ASSET_BUCKET = "business-assets";
const MAX_ASSET_BYTES = 4 * 1024 * 1024; // 4 MB
const ASSET_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB color.");

const schema = z.object({
  name: z.string().min(2, "Name is required.").max(80),
  brand_primary_color: hex,
  brand_secondary_color: hex,
  timezone: z.string().min(1).max(64),
});

export interface SettingsState {
  error?: string;
  ok?: boolean;
}

/**
 * Upload an image from a form field to the business-assets bucket and return
 * its public URL. Returns null when no file was provided. Throws (with a
 * user-facing message) on an invalid type/size or a storage error.
 */
async function uploadAsset(
  supabase: SupabaseClient<Database>,
  businessId: string,
  kind: "logo" | "background",
  file: FormDataEntryValue | null,
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;

  const ext = ASSET_TYPES[file.type];
  if (!ext) throw new Error("Images must be PNG, JPEG, or WebP.");
  if (file.size > MAX_ASSET_BYTES)
    throw new Error("Images must be under 4 MB.");

  // Unique filename per upload so wallet services (which cache by URL) always
  // pick up a replaced image.
  const path = `${businessId}/${kind}-${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  return supabase.storage.from(ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function updateBusiness(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { membership } = await requireRole(["owner", "admin"]);
  const businessId = membership.business.id;

  const parsed = schema.safeParse({
    name: formData.get("name"),
    brand_primary_color: formData.get("brand_primary_color"),
    brand_secondary_color: formData.get("brand_secondary_color"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // Only overwrite an asset column when the user uploaded a new file or asked
  // to remove the existing one; otherwise leave the stored value untouched.
  const update: Database["public"]["Tables"]["businesses"]["Update"] = {
    name: parsed.data.name,
    brand_primary_color: parsed.data.brand_primary_color,
    brand_secondary_color: parsed.data.brand_secondary_color,
    // An unchecked checkbox is absent from the form data.
    show_business_name: formData.get("show_business_name") === "1",
    timezone: parsed.data.timezone,
  };

  try {
    const logoUrl = await uploadAsset(
      supabase,
      businessId,
      "logo",
      formData.get("logo"),
    );
    if (logoUrl) update.logo_url = logoUrl;
    else if (formData.get("remove_logo") === "1") update.logo_url = null;

    const bgUrl = await uploadAsset(
      supabase,
      businessId,
      "background",
      formData.get("background_image"),
    );
    if (bgUrl) update.background_image_url = bgUrl;
    else if (formData.get("remove_background") === "1")
      update.background_image_url = null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }

  const { error } = await supabase
    .from("businesses")
    .update(update)
    .eq("id", businessId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
