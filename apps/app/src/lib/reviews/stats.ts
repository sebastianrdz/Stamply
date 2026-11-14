import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Review-link taps over the last `days`: total clicks and distinct customers,
 * from every source (wallet invite and card-page button). Takes the client so
 * callers choose the RLS session or the service role.
 */
export async function getReviewStats(
  client: SupabaseClient<Database>,
  businessId: string,
  days = 90,
  now = new Date(),
): Promise<{ clicks: number; clickers: number }> {
  const { data, error } = await client.rpc("review_clicks_summary", {
    p_business_id: businessId,
    p_since: new Date(now.getTime() - days * 86_400_000).toISOString(),
  });
  if (error) throw error;
  return { clicks: data?.[0]?.clicks ?? 0, clickers: data?.[0]?.clickers ?? 0 };
}
