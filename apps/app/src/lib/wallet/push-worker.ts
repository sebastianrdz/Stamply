import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { fetchAll } from "@/lib/pagination";
import { pushToDevices } from "@/lib/wallet/apple/apns";
import type { CardWithRelations } from "@/lib/cards/queries";
import {
  addOfferMessage,
  patchLoyaltyObject,
} from "@/lib/wallet/google/wallet";

type Client = SupabaseClient<Database>;

export interface DrainOptions {
  budgetMs: number;
  batchSize?: number;
  googleConcurrency?: number;
  leaseSeconds?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface DrainResult {
  delivered: number;
  failed: number;
  /** Offers still `pending` when the run ended. */
  remainingOffers: number;
}

const MAX_ATTEMPTS = 3;
const GOOGLE_RETRIES = 3;
const OFFER_PAGE = 20;

function errorCode(e: unknown): string {
  const x = e as { code?: unknown; response?: { status?: unknown } };
  const status = x?.response?.status ?? x?.code;
  // Codes only: error messages from providers can echo identifiers.
  return `error ${typeof status === "string" || typeof status === "number" ? status : "unknown"}`.slice(
    0,
    200,
  );
}

/** Run a Google call, retrying on 429 (honours retry-after). */
async function retry429(
  call: () => Promise<void>,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (e) {
      const res = (
        e as {
          response?: { status?: number; headers?: Record<string, string> };
        }
      ).response;
      if (res?.status !== 429 || attempt >= GOOGLE_RETRIES) throw e;
      const after = Number(res.headers?.["retry-after"]);
      await sleep(
        Number.isFinite(after) && after > 0
          ? Math.min(after * 1000, 10_000)
          : 500 * 2 ** attempt,
      );
    }
  }
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function pool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

type Offer = { id: string; business_id: string; body: string };

/** Deliver one claimed batch; returns counts. Marks recipients as it goes. */
async function deliverBatch(
  admin: Client,
  offer: Offer,
  customerIds: string[],
  googleConcurrency: number,
  sleep: (ms: number) => Promise<void>,
): Promise<{ delivered: number; failed: number }> {
  const markDelivered = async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await admin
      .from("wallet_offer_recipients")
      .update({ delivered_at: new Date().toISOString(), last_error: null })
      .eq("offer_id", offer.id)
      .in("customer_id", ids);
    if (error) throw error;
  };
  const markFailed = async (ids: string[], message: string) => {
    if (!ids.length) return;
    await admin
      .from("wallet_offer_recipients")
      .update({ last_error: message.slice(0, 200) })
      .eq("offer_id", offer.id)
      .in("customer_id", ids);
  };

  try {
    const cards = await fetchAll<{
      id: string;
      customer_id: string;
      google_object_id: string | null;
    }>((from, to) =>
      admin
        .from("cards")
        .select("id, customer_id, google_object_id")
        .eq("business_id", offer.business_id)
        .in("customer_id", customerIds)
        .order("id")
        .range(from, to),
    );
    const cardIds = cards.map((c) => c.id);

    if (cardIds.length) {
      const { error } = await admin
        .from("cards")
        .update({ updated_at: new Date().toISOString() })
        .in("id", cardIds);
      if (error) throw error;

      const tokens = await fetchAll<{ push_token: string }>((from, to) =>
        admin
          .from("apple_registrations")
          .select("push_token")
          .in("card_id", cardIds)
          .order("id")
          .range(from, to),
      );
      // Isolated from Google: an APNs outage must not block delivery. Apple
      // pushes are idempotent and the pass refetches on the next push.
      await pushToDevices(tokens.map((t) => t.push_token)).catch((e) =>
        console.error("[push-worker] apple push failed", {
          offerId: offer.id,
          error: errorCode(e),
        }),
      );
    }

    // Customers with nothing for Google (or no card at all) are done now.
    const googleByCustomer = new Map<string, string[]>();
    for (const c of cards)
      if (c.google_object_id)
        googleByCustomer.set(c.customer_id, [
          ...(googleByCustomer.get(c.customer_id) ?? []),
          c.id,
        ]);
    const noGoogle = customerIds.filter((id) => !googleByCustomer.has(id));
    await markDelivered(noGoogle);
    let delivered = noGoogle.length;
    let failed = 0;

    await pool([...googleByCustomer], googleConcurrency, async ([cid, ids]) => {
      try {
        for (const cardId of ids)
          await retry429(() => addOfferMessage(cardId, offer), sleep);
        await markDelivered([cid]);
        delivered++;
      } catch (e) {
        failed++;
        console.error("[push-worker] google offer message failed", {
          offerId: offer.id,
          error: errorCode(e),
        });
        await markFailed([cid], `google ${errorCode(e)}`);
      }
    });
    return { delivered, failed };
  } catch (e) {
    console.error("[push-worker] batch failed", {
      offerId: offer.id,
      error: errorCode(e),
    });
    await markFailed(customerIds, `batch ${errorCode(e)}`);
    return { delivered: 0, failed: customerIds.length };
  }
}

/**
 * Deliver pending broadcast offers in leased batches until the wall-clock
 * budget is spent. Safe to run concurrently and to re-run: claims are leased
 * per recipient and delivered recipients are never claimed again.
 */
export async function drainOfferDeliveries(
  admin: Client,
  opts: DrainOptions,
): Promise<DrainResult> {
  const {
    budgetMs,
    batchSize = 200,
    googleConcurrency = 10,
    leaseSeconds = 120,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = opts;
  const deadline = Date.now() + budgetMs;
  let delivered = 0;
  let failed = 0;

  const pendingOffers = async () => {
    const { data, error } = await admin
      .from("wallet_offers")
      .select("id, business_id, body")
      .eq("delivery", "pending")
      .order("created_at")
      .order("id")
      .limit(OFFER_PAGE);
    if (error) throw error;
    return (data ?? []) as Offer[];
  };

  let claimedAny = true;
  while (claimedAny && Date.now() < deadline) {
    claimedAny = false;
    for (const offer of await pendingOffers()) {
      if (Date.now() >= deadline) break;
      const { data: claimed, error } = await admin.rpc(
        "claim_offer_recipients",
        {
          p_offer_id: offer.id,
          p_limit: batchSize,
          p_lease_seconds: leaseSeconds,
          p_max_attempts: MAX_ATTEMPTS,
        },
      );
      if (error) throw error;
      if (!claimed?.length) {
        await admin.rpc("finish_offer_delivery", {
          p_offer_id: offer.id,
          p_max_attempts: MAX_ATTEMPTS,
        });
        continue;
      }
      claimedAny = true;
      const r = await deliverBatch(
        admin,
        offer,
        claimed.map((c) => c.customer_id),
        googleConcurrency,
        sleep,
      );
      delivered += r.delivered;
      failed += r.failed;
    }
  }

  const { count } = await admin
    .from("wallet_offers")
    .select("id", { count: "exact", head: true })
    .eq("delivery", "pending");
  return { delivered, failed, remainingOffers: count ?? 0 };
}

export interface RefreshResult {
  refreshed: number;
  failed: number;
  /** Queue rows still claimable (not out of attempts). */
  remaining: number;
}

/**
 * Refresh queued cards (program design changed): push Apple, patch Google,
 * delete the queue row of each finished card. Failures keep the row with a
 * `last_error` code; the claim already counted the attempt.
 */
export async function drainWalletRefresh(
  admin: Client,
  opts: DrainOptions,
): Promise<RefreshResult> {
  const {
    budgetMs,
    batchSize = 50,
    googleConcurrency = 5,
    leaseSeconds = 300,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = opts;
  const deadline = Date.now() + budgetMs;
  let refreshed = 0;
  let failed = 0;

  const done = async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await admin
      .from("wallet_refresh_queue")
      .delete()
      .in("card_id", ids);
    if (error) throw error;
    refreshed += ids.length;
  };
  const fail = async (ids: string[], message: string) => {
    if (!ids.length) return;
    failed += ids.length;
    await admin
      .from("wallet_refresh_queue")
      .update({ last_error: message.slice(0, 200) })
      .in("card_id", ids);
  };

  while (Date.now() < deadline) {
    const { data: claimed, error } = await admin.rpc("claim_wallet_refresh", {
      p_limit: batchSize,
      p_lease_seconds: leaseSeconds,
      p_max_attempts: MAX_ATTEMPTS,
    });
    if (error) throw error;
    if (!claimed?.length) break;
    const ids = claimed.map((c) => c.card_id);
    try {
      const cards = (await fetchAll((from, to) =>
        admin
          .from("cards")
          .select(
            "*, program:programs(*), business:businesses(*), customer:customers(*)",
          )
          .in("id", ids)
          .order("id")
          .range(from, to),
      )) as unknown as CardWithRelations[];
      // Cards deleted since they were queued have nothing to refresh.
      const found = new Set(cards.map((c) => c.id));
      await done(ids.filter((id) => !found.has(id)));

      const tokens = await fetchAll<{ push_token: string }>((from, to) =>
        admin
          .from("apple_registrations")
          .select("push_token")
          .in(
            "card_id",
            cards.map((c) => c.id),
          )
          .order("id")
          .range(from, to),
      );
      await pushToDevices(tokens.map((t) => t.push_token)).catch((e) =>
        console.error("[push-worker] apple refresh push failed", {
          error: errorCode(e),
        }),
      );

      await done(cards.filter((c) => !c.google_object_id).map((c) => c.id));
      await pool(
        cards.filter((c) => c.google_object_id),
        googleConcurrency,
        async (card) => {
          try {
            await retry429(() => patchLoyaltyObject(card), sleep);
            await done([card.id]);
          } catch (e) {
            console.error("[push-worker] google refresh failed", {
              cardId: card.id,
              error: errorCode(e),
            });
            await fail([card.id], `google ${errorCode(e)}`);
          }
        },
      );
    } catch (e) {
      console.error("[push-worker] refresh batch failed", {
        error: errorCode(e),
      });
      await fail(ids, `batch ${errorCode(e)}`);
    }
  }

  const { count } = await admin
    .from("wallet_refresh_queue")
    .select("card_id", { count: "exact", head: true })
    .lt("attempts", MAX_ATTEMPTS);
  return { refreshed, failed, remaining: count ?? 0 };
}
