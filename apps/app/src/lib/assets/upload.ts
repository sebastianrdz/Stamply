import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Dictionary } from "@stamply/i18n/dictionaries";
import { isBusinessAssetUrl, type AssetKind } from "./url";

export const ASSET_BUCKET = "business-assets";
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

/**
 * Upload an image from a form field to the business-assets bucket and return
 * its public URL. Returns null when no file was provided. Throws (with a
 * user-facing message) on an invalid type/size or a storage error.
 */
export async function uploadAsset(
  supabase: SupabaseClient<Database>,
  businessId: string,
  kind: AssetKind,
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

/**
 * Resolve one image field of the card design form. Precedence: new file >
 * library pick > remove flag > keep. Returns `undefined` for "keep", `null`
 * for "none", else the URL. A picked URL must live in this business's own
 * folder (or equal `current`, which may be a legacy value) — never trust it.
 */
export async function resolveImageField(
  supabase: SupabaseClient<Database>,
  businessId: string,
  kind: AssetKind,
  formData: FormData,
  current: string | null | undefined,
  dict: Dictionary,
): Promise<string | null | undefined> {
  const uploaded = await uploadAsset(
    supabase,
    businessId,
    kind,
    formData.get(kind),
    dict,
  );
  if (uploaded) return uploaded;

  const pick = formData.get(`${kind}_pick`);
  if (typeof pick === "string" && pick !== "") {
    const folder = supabase.storage
      .from(ASSET_BUCKET)
      .getPublicUrl(`${businessId}/`).data.publicUrl;
    if (pick !== current && !isBusinessAssetUrl(pick, folder, kind))
      throw new Error(dict.dashboard.programs.errors.assetInvalid);
    return pick;
  }
  if (formData.get(`remove_${kind}`) === "1") return null;
  return undefined;
}
