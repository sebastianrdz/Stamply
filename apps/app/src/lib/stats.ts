import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface OverviewStats {
  customers: number;
  activeCards: number;
  stampsThisWeek: number;
  redemptions: number;
}

/** Overview counts for a business (RLS-scoped to the signed-in user). */
export async function getOverviewStats(
  businessId: string,
): Promise<OverviewStats> {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const count = (n: number | null) => n ?? 0;

  const [customers, activeCards, stampsWeek, redemptions] = await Promise.all([
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["active", "completed"]),
    supabase
      .from("stamp_events")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("kind", "stamp")
      .gte("created_at", weekAgo),
    supabase
      .from("redemptions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
  ]);

  return {
    customers: count(customers.count),
    activeCards: count(activeCards.count),
    stampsThisWeek: count(stampsWeek.count),
    redemptions: count(redemptions.count),
  };
}
