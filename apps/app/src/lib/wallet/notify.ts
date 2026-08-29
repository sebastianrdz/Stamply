import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getCardByToken, type CardWithRelations } from "@/lib/cards/queries";
import type { PassLocation } from "@/lib/wallet/apple/pass";
import { pushToDevices } from "@/lib/wallet/apple/apns";
import { patchLoyaltyObject } from "@/lib/wallet/google/wallet";

type Client = SupabaseClient<Database>;

/** Business locations as pass geo-relevance points. */
export async function businessLocations(
  supabase: Client,
  businessId: string,
): Promise<PassLocation[]> {
  const { data } = await supabase
    .from("locations")
    .select("name, lat, lng")
    .eq("business_id", businessId)
    .not("lat", "is", null)
    .not("lng", "is", null);
  return (data ?? [])
    .filter(
      (l): l is { name: string; lat: number; lng: number } =>
        l.lat != null && l.lng != null,
    )
    .map((l) => ({ name: l.name, lat: l.lat, lng: l.lng }));
}

/**
 * Propagate a card change to both wallets. Google is patched directly; Apple
 * devices get an APNs nudge to re-fetch. Each provider is isolated so a missing
 * credential or a transient failure in one doesn't block the other.
 */
export async function notifyCardUpdated(
  supabase: Client,
  card: CardWithRelations,
): Promise<void> {
  // Apple: push all registered devices for this card's serial.
  const applePush = (async () => {
    const { data } = await supabase
      .from("apple_registrations")
      .select("push_token")
      .eq("card_id", card.id);
    const tokens = (data ?? []).map((r) => r.push_token);
    if (tokens.length) await pushToDevices(tokens);
  })().catch((e) => console.error("[notify] apple push failed", e));

  // Google: patch the object if the card was ever added to Google Wallet.
  const googlePatch = (
    card.google_object_id ? patchLoyaltyObject(card) : Promise.resolve()
  ).catch((e) => console.error("[notify] google patch failed", e));

  await Promise.all([applePush, googlePatch]);
}

/** Convenience: reload a card by token and notify. */
export async function notifyCardByToken(
  supabase: Client,
  token: string,
): Promise<void> {
  const card = await getCardByToken(supabase, token);
  if (card) await notifyCardUpdated(supabase, card);
}

/**
 * Notify both wallets of a birthday-reward-driven change. Bumps `updated_at`
 * first: Apple's `buildApplePass` birthday branch (and Google's equivalent)
 * only fires when the pass is actually re-rendered, and Apple's webservice
 * re-fetch / Google's patch are both keyed off this card having changed —
 * without the bump there's nothing to trigger a re-render of the just-added
 * birthday content.
 */
export async function notifyCardUpdatedForBirthday(
  supabase: Client,
  card: CardWithRelations,
): Promise<void> {
  const { error } = await supabase
    .from("cards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", card.id);
  if (error) throw error;
  await notifyCardUpdated(supabase, card);
}
