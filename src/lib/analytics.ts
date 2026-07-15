import "server-only";

import { createClient } from "@/lib/supabase/server";

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

export async function getAnalytics(businessId: string): Promise<Analytics> {
  const supabase = await createClient();
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

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

  // Bucket stamps by day.
  const buckets = new Map<string, number>();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of events.data ?? []) {
    const key = new Date(e.created_at).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daily: DailyPoint[] = [...buckets.entries()].map(([date, stamps]) => ({
    date,
    label: weekday[new Date(date + "T00:00:00").getDay()],
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
