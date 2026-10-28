import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, localDate } from "@/lib/automations/dates";

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Mon"
  stamps: number;
}

export interface Analytics {
  daily: DailyPoint[];
  totalStamps: number;
  totalRedemptions: number;
  activeCards: number;
  redemptionRate: number; // redemptions / cards issued
}

const DAYS = 14;
const DAY_MS = 86_400_000;

export async function getAnalytics(
  businessId: string,
  timezone = "UTC",
): Promise<Analytics> {
  const supabase = await createClient();
  // One spare day so the first local day is fully covered whatever the offset.
  const since = new Date(Date.now() - (DAYS + 1) * DAY_MS);

  const [events, redemptions, cards] = await Promise.all([
    supabase
      .from("stamp_events")
      .select("created_at, kind")
      .eq("business_id", businessId)
      .eq("kind", "stamp")
      .gte("created_at", since.toISOString()),
    supabase
      .from("redemptions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
  ]);

  // Bucket stamps by the business's local day, ending today.
  const today = localDate(timezone, new Date());
  const buckets = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) buckets.set(addDays(today, -i), 0);
  for (const e of events.data ?? []) {
    const key = localDate(timezone, new Date(e.created_at));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daily: DailyPoint[] = [...buckets.entries()].map(([date, stamps]) => ({
    date,
    label: weekday[new Date(date + "T00:00:00Z").getUTCDay()],
    stamps,
  }));

  const totalStamps = daily.reduce((s, d) => s + d.stamps, 0);
  const totalRedemptions = redemptions.count ?? 0;
  const cardsIssued = cards.count ?? 0;

  return {
    daily,
    totalStamps,
    totalRedemptions,
    activeCards: cardsIssued,
    redemptionRate: cardsIssued ? totalRedemptions / cardsIssued : 0,
  };
}

export interface CardBreakdownRow {
  programId: string;
  name: string;
  cards: number;
  customers: number;
  stamps: number; // last DAYS days
  redemptions: number;
}

/**
 * Per-card (program) activity. shortcut: aggregates in JS over rows PostgREST
 * caps at 1000 per query, so counts saturate on very large businesses; move to
 * a grouped SQL view/RPC when one needs more.
 */
export async function getCardBreakdown(
  businessId: string,
): Promise<CardBreakdownRow[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [programs, cards, events, redemptions] = await Promise.all([
    supabase.from("programs").select("id, name").eq("business_id", businessId),
    supabase
      .from("cards")
      .select("id, program_id, customer_id")
      .eq("business_id", businessId),
    supabase
      .from("stamp_events")
      .select("card_id")
      .eq("business_id", businessId)
      .eq("kind", "stamp")
      .gte("created_at", since),
    supabase.from("redemptions").select("card_id").eq("business_id", businessId),
  ]);

  const programOf = new Map<string, string>();
  const rows = new Map<string, CardBreakdownRow & { people: Set<string> }>();
  for (const p of programs.data ?? []) {
    rows.set(p.id, {
      programId: p.id,
      name: p.name,
      cards: 0,
      customers: 0,
      stamps: 0,
      redemptions: 0,
      people: new Set(),
    });
  }
  for (const c of cards.data ?? []) {
    programOf.set(c.id, c.program_id);
    const r = rows.get(c.program_id);
    if (!r) continue;
    r.cards++;
    r.people.add(c.customer_id);
  }
  for (const e of events.data ?? []) {
    const r = rows.get(programOf.get(e.card_id) ?? "");
    if (r) r.stamps++;
  }
  for (const e of redemptions.data ?? []) {
    const r = rows.get(programOf.get(e.card_id) ?? "");
    if (r) r.redemptions++;
  }
  return [...rows.values()].map(({ people, ...r }) => ({
    ...r,
    customers: people.size,
  }));
}
