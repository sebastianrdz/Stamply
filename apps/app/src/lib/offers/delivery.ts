import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/pagination";
import type { Database } from "@/types/database";

export interface DeliveryProgress {
  delivered: number;
  pending: number;
  failed: number;
}

/**
 * Delivery progress for the broadcast history. Offers still being delivered get
 * live counts from `offer_delivery_status`; finished offers only need the few
 * recipients that gave up (3 failed attempts), found in one query. Takes the
 * caller's client: both read paths are covered by the members-only RLS policy.
 */
export async function getDeliveryProgress(
  client: SupabaseClient<Database>,
  offers: { id: string; delivery?: "pending" | "done" }[],
): Promise<Map<string, DeliveryProgress>> {
  const out = new Map<string, DeliveryProgress>();
  const pendingIds = offers
    .filter((o) => o.delivery === "pending")
    .map((o) => o.id);
  const doneIds = offers
    .filter((o) => o.delivery !== "pending")
    .map((o) => o.id);

  await Promise.all(
    pendingIds.map(async (id) => {
      const { data, error } = await client.rpc("offer_delivery_status", {
        p_offer_id: id,
      });
      if (error) throw error;
      const r = data?.[0];
      out.set(id, {
        delivered: r?.delivered ?? 0,
        pending: r?.pending ?? 0,
        failed: r?.failed ?? 0,
      });
    }),
  );

  if (doneIds.length) {
    const gaveUp = await fetchAll((from, to) =>
      client
        .from("wallet_offer_recipients")
        .select("offer_id, customer_id")
        .in("offer_id", doneIds)
        .is("delivered_at", null)
        .gte("attempts", 3)
        .order("offer_id")
        .order("customer_id")
        .range(from, to),
    );
    for (const r of gaveUp) {
      const cur = out.get(r.offer_id) ?? {
        delivered: 0,
        pending: 0,
        failed: 0,
      };
      out.set(r.offer_id, { ...cur, failed: cur.failed + 1 });
    }
  }
  return out;
}
