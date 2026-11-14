import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tzOrUtc } from "@/lib/automations/dates";
import { periodBounds } from "@/lib/roi";
import type { Database, EmployeeActivityRow } from "@/types/database";

export interface StaffRow {
  /** URL key: the user id, or "deleted" when the account no longer exists. */
  key: string;
  /** null = no longer on the team ("Former team member" in the UI). */
  name: string | null;
  stamps: number;
  redemptions: number;
  overrides: number;
  activeDays: number;
  stampsPerActiveDay: number;
}

export const DELETED_KEY = "deleted";
const keyOf = (id: string | null) => id ?? DELETED_KEY;

/** Totals per staff member, busiest first. `names` maps user id to a display name. */
export function summarize(
  rows: EmployeeActivityRow[],
  names: Map<string, string>,
): StaffRow[] {
  const by = new Map<string, StaffRow>();
  for (const r of rows) {
    const key = keyOf(r.employee_id);
    const s =
      by.get(key) ??
      ({
        key,
        name: (r.employee_id && names.get(r.employee_id)) || null,
        stamps: 0,
        redemptions: 0,
        overrides: 0,
        activeDays: 0,
        stampsPerActiveDay: 0,
      } satisfies StaffRow);
    s.stamps += r.stamps;
    s.redemptions += r.redemptions;
    s.overrides += r.overrides;
    if (r.stamps + r.redemptions > 0) s.activeDays += 1;
    by.set(key, s);
  }
  return [...by.values()]
    .map((s) => ({
      ...s,
      stampsPerActiveDay: s.activeDays
        ? Math.round((s.stamps / s.activeDays) * 10) / 10
        : 0,
    }))
    .sort((a, b) => b.stamps + b.redemptions - (a.stamps + a.redemptions));
}

/** One staff member's days, newest first. */
export function dailyFor(rows: EmployeeActivityRow[], key: string) {
  return rows
    .filter((r) => keyOf(r.employee_id) === key)
    .sort((a, b) => b.day.localeCompare(a.day));
}

export async function getEmployeeReport(
  client: SupabaseClient<Database>,
  business: { id: string; timezone: string },
  days: number,
  now = new Date(),
) {
  const tz = tzOrUtc(business.timezone);
  const { from, to } = periodBounds(tz, days, now);
  const [{ data: rows, error }, { data: members, error: membersError }] =
    await Promise.all([
      client.rpc("employee_activity", {
        p_business_id: business.id,
        p_from: from,
        p_to: to,
        p_tz: tz,
      }),
      client
        .from("memberships")
        .select("user_id, email")
        .eq("business_id", business.id),
    ]);
  if (error) throw error;
  if (membersError) throw membersError;

  const names = new Map<string, string>();
  for (const m of members ?? []) if (m.email) names.set(m.user_id, m.email);
  const activity = rows ?? [];
  return { staff: summarize(activity, names), activity };
}
