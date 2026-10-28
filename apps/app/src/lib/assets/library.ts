import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ASSET_BUCKET } from "./upload";
import type { AssetKind } from "./url";

export type AssetLibrary = Record<AssetKind, { url: string; name: string }[]>;

/** Files in `business-assets/{businessId}/`, grouped by filename prefix, newest first. */
export async function listAssets(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<AssetLibrary> {
  const out: AssetLibrary = { logo: [], background: [], stamp: [] };
  const bucket = supabase.storage.from(ASSET_BUCKET);
  const { data, error } = await bucket.list(businessId, {
    limit: 1000,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) {
    console.error("[assets] list failed", error);
    return out;
  }
  for (const f of data ?? []) {
    const kind = (["logo", "background", "stamp"] as const).find((k) =>
      f.name.startsWith(`${k}-`),
    );
    if (!kind) continue;
    out[kind].push({
      name: f.name,
      url: bucket.getPublicUrl(`${businessId}/${f.name}`).data.publicUrl,
    });
  }
  return out;
}
