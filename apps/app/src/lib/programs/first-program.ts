import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Program } from "@/types/database";

/** The business's oldest card: the draft built during first-run setup. */
export async function getFirstProgram(
  businessId: string,
): Promise<Program | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return (data as Program | null) ?? null;
}
