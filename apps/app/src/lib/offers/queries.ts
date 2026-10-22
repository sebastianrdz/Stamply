import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WalletOffer } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * The offer currently shown on a card's pass: the newest one addressed to
 * everyone (customer_id null) or to this customer specifically.
 */
export async function latestOfferForCard(
  supabase: Client,
  card: { business_id: string; customer_id: string },
): Promise<WalletOffer | null> {
  const { data, error } = await supabase
    .from("wallet_offers")
    .select("*")
    .eq("business_id", card.business_id)
    .or(`customer_id.is.null,customer_id.eq.${card.customer_id}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[offers/queries] latestOfferForCard failed", {
      businessId: card.business_id,
      error,
    });
    throw error;
  }
  return data;
}
