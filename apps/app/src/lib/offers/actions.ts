"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sendWalletOffers } from "./send";
import { appUrl } from "@/lib/urls";
import { requireEnv } from "@/lib/env";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";

export interface OfferFormState {
  error?: string;
  sent?: number;
  /** Broadcast accepted; delivery continues in the background. */
  queued?: boolean;
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
  // must not be skippable from the browser.
  let result;
  try {
    result = await sendWalletOffers(createAdminClient(), {
      businessId,
      body,
      customerIds,
      createdBy: user.id,
    });
  } catch (e) {
    console.error("[offers] notify failed", { businessId, e });
    return { error: dict.errors.deliveryFailed };
  }
  if (!result.ok) {
    if (result.reason === "noRecipients")
      return { error: dict.errors.noRecipients };
    if (result.reason === "notOptedIn")
      return { error: dict.errors.notOptedIn };
    return { error: result.message ?? dict.errors.deliveryFailed };
  }
  revalidatePath("/dashboard/broadcast");
  if (result.queued) {
    // Start delivering now via the cron route (it chains until done); the
    // secret stays server-side.
    after(() =>
      fetch(`${appUrl()}/api/cron/wallet-push`, {
        headers: {
          authorization: `Bearer ${requireEnv("CRON_SECRET", "offers")}`,
        },
      }).catch((e) => console.error("[offers] kick failed", { businessId, e })),
    );
    return { sent: result.recipients, queued: true };
  }
  return { sent: result.sent };
}
