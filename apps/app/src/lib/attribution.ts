import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tzOrUtc } from "@/lib/automations/dates";
import type { Database } from "@/types/database";

export interface Attribution {
  sent: number;
  returned: number;
}

export const ATTRIBUTION_DAYS = 90;

/**
 * Sent / returned per broadcast (by offer id) and per automation (by
 * reward_definitions id) over the last `sinceDays`. The SQL does the
 * last-message-wins crediting; automation rows already come grouped.
 */
export async function getAttribution(
  client: SupabaseClient<Database>,
  business: { id: string; timezone: string },
  sinceDays = ATTRIBUTION_DAYS,
  now = new Date(),
): Promise<{
  byOffer: Map<string, Attribution>;
  byAutomation: Map<string, Attribution>;
}> {
  const { data, error } = await client.rpc("message_attribution", {
    p_business_id: business.id,
    p_since: new Date(now.getTime() - sinceDays * 86_400_000).toISOString(),
    p_tz: tzOrUtc(business.timezone),
  });
  if (error) throw error;

  const byOffer = new Map<string, Attribution>();
  const byAutomation = new Map<string, Attribution>();
  for (const r of data ?? []) {
    const value = { sent: r.sent, returned: r.returned };
    if (r.automation_id) byAutomation.set(r.automation_id, value);
    else if (r.offer_id) byOffer.set(r.offer_id, value);
  }
  return { byOffer, byAutomation };
}

export const conversionPercent = (a: Attribution) =>
  a.sent ? Math.round((a.returned / a.sent) * 100) : 0;
