import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Referral numbers for the dashboard: friends who joined through an invite in
 * the last `days`, and referrals paid out in that window. Takes the client so
 * the page passes its RLS session.
 */
export async function getReferralStats(
  client: SupabaseClient<Database>,
  businessId: string,
  days: number,
  now = new Date(),
): Promise<{ referred: number; rewarded: number }> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const [referred, rewarded] = await Promise.all([
    client
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", since),
    client
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "rewarded")
      .gte("rewarded_at", since),
  ]);
  if (referred.error) throw referred.error;
  if (rewarded.error) throw rewarded.error;
  return { referred: referred.count ?? 0, rewarded: rewarded.count ?? 0 };
}
