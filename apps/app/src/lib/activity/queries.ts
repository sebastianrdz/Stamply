import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityFeedRow, ActivityType, Database } from "@/types/database";
import { paginate, PAGE_SIZE, type ActivityFilters } from "./paginate";

export async function fetchActivity(
  supabase: SupabaseClient<Database>,
  businessId: string,
  filters: ActivityFilters,
) {
  let q = supabase
    .from("activity_feed")
    .select("*")
    .eq("business_id", businessId)
    .order("occurred_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (filters.type) q = q.eq("type", filters.type as ActivityType);
  if (filters.location) q = q.eq("location_id", filters.location);
  if (filters.card) q = q.eq("card_id", filters.card);
  if (filters.cursor) q = q.lt("occurred_at", filters.cursor);
  const { data } = await q;
  return paginate((data ?? []) as ActivityFeedRow[]);
}
