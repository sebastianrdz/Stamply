import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyOffers } from "@/lib/wallet/notify";
import type { Database, WalletOffer } from "@/types/database";

export type SendOffersResult =
  | { ok: true; sent: number }
  | {
      ok: false;
      reason: "lookup" | "noRecipients" | "notOptedIn" | "insert";
      message?: string;
    };

/**
 * The one place the broadcast rule lives: only `marketing_consent` customers
 * of the business are ever messaged. No `customerIds` = one offer for every
 * opted-in customer; otherwise one offer per chosen customer (all must be
 * opted in). Inserts the wallet_offers rows and pushes them. Needs a
 * service-role client (wallet_offers has no insert policy). Throws if the
 * wallet notify fails (rows are already stored, like before).
 */
export async function sendWalletOffers(
  admin: SupabaseClient<Database>,
  params: {
    businessId: string;
    body: string;
    customerIds?: string[];
    createdBy?: string | null;
    /** Set when an automation (not a Broadcast) sends this offer. */
    automationId?: string | null;
  },
): Promise<SendOffersResult> {
  const { businessId, body, createdBy = null, automationId = null } = params;
  const customerIds = params.customerIds ?? [];

  let query = admin
    .from("customers")
    .select("id", { count: "exact" })
    .eq("business_id", businessId)
    .eq("marketing_consent", true);
  if (customerIds.length) query = query.in("id", customerIds);
  const { data: eligible, count, error: lookupError } = await query;
  if (lookupError) {
    return { ok: false, reason: "lookup", message: lookupError.message };
  }
  if (!count) return { ok: false, reason: "noRecipients" };
  if (customerIds.length && count !== customerIds.length) {
    return { ok: false, reason: "notOptedIn" };
  }

  const rows: Database["public"]["Tables"]["wallet_offers"]["Insert"][] =
    customerIds.length
      ? (eligible ?? []).map((c) => ({
          business_id: businessId,
          customer_id: c.id,
          body,
          created_by: createdBy,
          automation_id: automationId,
        }))
      : [
          {
            business_id: businessId,
            customer_id: null,
            body,
            created_by: createdBy,
          automation_id: automationId,
          },
        ];
  const { data: offers, error } = await admin
    .from("wallet_offers")
    .insert(rows)
    .select("*");
  if (error) return { ok: false, reason: "insert", message: error.message };

  const sent = await notifyOffers(admin, offers as WalletOffer[]);
  return { ok: true, sent };
}
