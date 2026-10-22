"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { notifyOffers } from "@/lib/wallet/notify";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import type { Database, WalletOffer } from "@/types/database";

export interface OfferFormState {
  error?: string;
  sent?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_DAY = 5;

/**
 * Send a wallet offer to every opted-in customer (no `customerIds`) or to the
 * chosen ones. Only opted-in customers are ever notified.
 */
export async function sendOffer(
  _prev: OfferFormState,
  formData: FormData,
): Promise<OfferFormState> {
  const { user, membership } = await requireRole(["owner", "admin"]);
  const businessId = membership.business.id;
  const dict = (await getDictionary(await getLocale())).dashboard.offers;

  const parsed = z
    .object({
      body: z.string().trim().min(1, dict.errors.bodyRequired).max(200),
      customerIds: z.array(z.string().uuid()).max(500),
    })
    .safeParse({
      body: formData.get("body"),
      customerIds: formData.getAll("customerIds"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { body, customerIds } = parsed.data;

  if (!(await rateLimit(`offer:${businessId}`, MAX_PER_DAY, DAY_MS))) {
    return { error: dict.errors.rateLimited };
  }

  // Service role: wallet_offers has no insert policy, and the consent check
  // below must not be skippable from the browser.
  const admin = createAdminClient();
  let query = admin
    .from("customers")
    .select("id", { count: "exact" })
    .eq("business_id", businessId)
    .eq("marketing_consent", true);
  if (customerIds.length) query = query.in("id", customerIds);
  const { data: eligible, count, error: lookupError } = await query;
  if (lookupError) return { error: lookupError.message };
  if (!count) return { error: dict.errors.noRecipients };
  if (customerIds.length && count !== customerIds.length) {
    return { error: dict.errors.notOptedIn };
  }

  const rows: Database["public"]["Tables"]["wallet_offers"]["Insert"][] =
    customerIds.length
      ? (eligible ?? []).map((c) => ({
          business_id: businessId,
          customer_id: c.id,
          body,
          created_by: user.id,
        }))
      : [
          {
            business_id: businessId,
            customer_id: null,
            body,
            created_by: user.id,
          },
        ];
  const { data: offers, error } = await admin
    .from("wallet_offers")
    .insert(rows)
    .select("*");
  if (error) return { error: error.message };

  let sent = 0;
  try {
    sent = await notifyOffers(admin, offers as WalletOffer[]);
  } catch (e) {
    console.error("[offers] notify failed", { businessId, e });
    return { error: dict.errors.deliveryFailed };
  }

  revalidatePath("/dashboard/offers");
  return { sent };
}
