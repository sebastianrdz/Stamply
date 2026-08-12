"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary, type Dictionary } from "@stamply/i18n/dictionaries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const ASSET_BUCKET = "business-assets";
const MAX_ASSET_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_SVG_BYTES = 1 * 1024 * 1024; // 1 MB
const ASSET_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
// Separate from ASSET_TYPES so SVG is ONLY ever accepted for the stamp-icon
// kind, never for logo/background.
const STAMP_ASSET_TYPES: Record<string, string> = {
  "image/svg+xml": "svg",
};

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
  kind: "logo" | "background" | "stamp",
  file: FormDataEntryValue | null,
  dict: Dictionary,
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;

  // SVGs are rendered *inside the app* only as a CSS `mask-image` (never
  // inlined as markup nor via <img>), so an embedded `<script>` never executes
  // in our origin — hence no server-side SVG sanitization here. Caveat: the
  // asset also lives in a PUBLIC bucket, so navigating directly to its storage
  // URL would render/execute the SVG on the *storage* origin (which carries no
  // app session/cookies — impact is low, but not zero). Accepted risk for now;
  // a stricter option is stripping <script>/on*=/javascript: on upload or
  // serving the stamp kind with Content-Disposition: attachment. The write
  // boundary is unchanged from logo/background: `upsert: false` + the
  // per-business folder path enforced by existing storage RLS.
  const ext = kind === "stamp" ? STAMP_ASSET_TYPES[file.type] : ASSET_TYPES[file.type];
  if (!ext)
    throw new Error(
      kind === "stamp"
        ? dict.dashboard.settings.errors.stampIconType
        : dict.dashboard.settings.errors.imageType,
    );
  const maxBytes = kind === "stamp" ? MAX_SVG_BYTES : MAX_ASSET_BYTES;
  if (file.size > maxBytes)
    throw new Error(
      kind === "stamp"
        ? dict.dashboard.settings.errors.stampIconTooLarge
        : dict.dashboard.settings.errors.imageTooLarge,
    );

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
  const dict = await getDictionary(await getLocale());
  const { membership } = await requireRole(["owner", "admin"]);
  const businessId = membership.business.id;

  const hex = z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, dict.dashboard.settings.errors.colorFormat);

  const schema = z.object({
    name: z
      .string()
      .min(2, dict.dashboard.settings.errors.businessNameRequired)
      .max(80),
    brand_primary_color: hex,
    brand_secondary_color: hex,
    timezone: z.string().min(1).max(64),
  });

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
      dict,
    );
    if (logoUrl) update.logo_url = logoUrl;
    else if (formData.get("remove_logo") === "1") update.logo_url = null;

    const bgUrl = await uploadAsset(
      supabase,
      businessId,
      "background",
      formData.get("background_image"),
      dict,
    );
    if (bgUrl) update.background_image_url = bgUrl;
    else if (formData.get("remove_background") === "1")
      update.background_image_url = null;

    const stampIconUrl = await uploadAsset(
      supabase,
      businessId,
      "stamp",
      formData.get("stamp_icon"),
      dict,
    );
    if (stampIconUrl) update.stamp_icon_url = stampIconUrl;
    else if (formData.get("remove_stamp_icon") === "1")
      update.stamp_icon_url = null;
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : dict.dashboard.settings.errors.uploadFailed,
    };
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
