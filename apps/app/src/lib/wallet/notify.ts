import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getCardByToken, type CardWithRelations } from "@/lib/cards/queries";
import type { PassLocation } from "@/lib/wallet/apple/pass";
import { pushToDevices } from "@/lib/wallet/apple/apns";
import {
  addOfferMessage,
  patchLoyaltyClass,
  patchLoyaltyObject,
} from "@/lib/wallet/google/wallet";
import type { WalletOffer } from "@/types/database";

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

/**
 * A program's design changed: bump `updated_at` on its cards (so Apple's
 * refetch sees a change), patch the Google class once, then notify every card
 * in batches of 20 (same bounded concurrency as notifyOffers).
 *
 * shortcut: inline in the server action; move to a queue past a few thousand
 * cards per program (function timeout).
 */
export async function notifyProgramDesignChanged(
  supabase: Client,
  programId: string,
): Promise<void> {
  const { error } = await supabase
    .from("cards")
    .update({ updated_at: new Date().toISOString() })
    .eq("program_id", programId);
  if (error) throw error;
  const { data, error: selError } = await supabase
    .from("cards")
    .select("*, program:programs(*), business:businesses(*), customer:customers(*)")
    .eq("program_id", programId);
  if (selError) throw selError;
  const cards = (data ?? []) as unknown as CardWithRelations[];
  const google = cards.find((c) => c.google_object_id);
  if (google)
    await patchLoyaltyClass(google).catch((e) =>
      console.error("[notify] google class patch failed", e),
    );
  for (const part of chunk(cards, 20))
    await Promise.all(part.map((c) => notifyCardUpdated(supabase, c)));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

type OfferTarget = {
  id: string;
  customer_id: string;
  google_object_id: string | null;
  offer: WalletOffer;
};

/** Cards (of opted-in customers only) that should receive these offers. */
async function offerTargets(
  supabase: Client,
  offers: WalletOffer[],
): Promise<OfferTarget[]> {
  const select =
    "id, customer_id, google_object_id, customer:customers!inner(marketing_consent)";
  type Row = Omit<OfferTarget, "offer">;
  if (offers.length === 1 && offers[0].customer_id === null) {
    const { data, error } = await supabase
      .from("cards")
      .select(select)
      .eq("business_id", offers[0].business_id)
      .eq("customer.marketing_consent", true);
    if (error) throw error;
    return ((data ?? []) as unknown as Row[]).map((c) => ({
      ...c,
      offer: offers[0],
    }));
  }
  const byCustomer = new Map(offers.map((o) => [o.customer_id, o]));
  const out: OfferTarget[] = [];
  for (const part of chunk([...byCustomer.keys()] as string[], 200)) {
    const { data, error } = await supabase
      .from("cards")
      .select(select)
      .eq("business_id", offers[0].business_id)
      .eq("customer.marketing_consent", true)
      .in("customer_id", part);
    if (error) throw error;
    for (const c of (data ?? []) as unknown as Row[]) {
      out.push({ ...c, offer: byCustomer.get(c.customer_id)! });
    }
  }
  return out;
}

/**
 * Deliver business offers to the passes of opted-in customers: either one
 * offer with customer_id null (everyone) or one offer per chosen customer.
 * Returns how many passes were targeted. Bumps `updated_at` so Apple's
 * refetch sees a changed pass, then nudges Apple devices (the refetched
 * `changeMessage` field shows the notification) and adds a notifying message
 * to each Google object. Providers are isolated like notifyCardUpdated.
 *
 * shortcut: runs inline in the calling server action; move to a queue once a
 * business has thousands of Google passes (function timeout).
 */
export async function notifyOffers(
  supabase: Client,
  offers: WalletOffer[],
): Promise<number> {
  if (offers.length === 0) return 0;
  const targets = await offerTargets(supabase, offers);
  if (targets.length === 0) return 0;

  const ids = targets.map((t) => t.id);
  const now = new Date().toISOString();
  for (const part of chunk(ids, 200)) {
    const { error } = await supabase
      .from("cards")
      .update({ updated_at: now })
      .in("id", part);
    if (error) throw error;
  }

  const applePush = (async () => {
    for (const part of chunk(ids, 200)) {
      const { data } = await supabase
        .from("apple_registrations")
        .select("push_token")
        .in("card_id", part);
      await pushToDevices((data ?? []).map((r) => r.push_token));
    }
  })().catch((e) => console.error("[notify] apple offer push failed", e));

  const googleAdd = (async () => {
    const withGoogle = targets.filter((t) => t.google_object_id);
    for (const part of chunk(withGoogle, 20)) {
      await Promise.all(
        part.map((t) =>
          addOfferMessage(t.id, t.offer).catch((e) =>
            console.error("[notify] google offer message failed", {
              cardId: t.id,
              e,
            }),
          ),
        ),
      );
    }
  })();

  await Promise.all([applePush, googleAdd]);
  return targets.length;
}
