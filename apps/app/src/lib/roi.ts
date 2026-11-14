import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, localDate, tzOrUtc } from "@/lib/automations/dates";
import { configNumber } from "@/lib/automations/config";
import type { Database } from "@/types/database";

export interface Roi {
  activeCustomers: number;
  returningCustomers: number;
  returningVisits: number;
  /** Returning customers / customers who visited in the period. */
  repeatRate: number;
  avgDaysBetween: number | null;
  atRisk: number;
  atRiskFromDays: number;
  attributedVisits: number;
  /** null when the business hasn't set an average ticket. */
  estimatedRevenueCents: number | null;
}

/** Inclusive local-date window of `days` days ending today in `tz`. */
export function periodBounds(tz: string, days: number, now = new Date()) {
  const to = localDate(tz, now);
  return { from: addDays(to, -(days - 1)), to };
}

export function estimateRevenue(
  returningVisits: number,
  ticketCents: number | null | undefined,
): number | null {
  return ticketCents ? returningVisits * ticketCents : null;
}

/**
 * ROI numbers for a business over the last `days` days. Takes the client so
 * the dashboard passes its RLS session and the monthly cron the service role.
 */
export async function getRoi(
  client: SupabaseClient<Database>,
  business: {
    id: string;
    timezone: string;
    average_ticket_cents?: number | null;
  },
  days: number,
  now = new Date(),
): Promise<Roi> {
  const tz = tzOrUtc(business.timezone);
  const { from, to } = periodBounds(tz, days, now);

  // At risk = silent for N..2N days, N = the win-back threshold (default if off).
  const { data: winBack, error: defError } = await client
    .from("reward_definitions")
    .select("config")
    .eq("business_id", business.id)
    .eq("type", "win_back")
    .eq("active", true)
    .maybeSingle();
  if (defError) throw defError;
  const atRiskFromDays = configNumber("win_back", winBack?.config);

  const { data, error } = await client.rpc("roi_summary", {
    p_business_id: business.id,
    p_from: from,
    p_to: to,
    p_tz: tz,
    p_at_risk_days: atRiskFromDays,
  });
  if (error) throw error;
  const r = data?.[0];

  const active = r?.active_customers ?? 0;
  const returning = r?.returning_customers ?? 0;
  const returningVisits = r?.returning_visits ?? 0;
  return {
    activeCustomers: active,
    returningCustomers: returning,
    returningVisits,
    repeatRate: active ? returning / active : 0,
    avgDaysBetween: r?.avg_days_between ?? null,
    atRisk: r?.at_risk ?? 0,
    atRiskFromDays,
    attributedVisits: r?.attributed_visits ?? 0,
    estimatedRevenueCents: estimateRevenue(
      returningVisits,
      business.average_ticket_cents,
    ),
  };
}
