import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCardById } from "@/lib/cards/queries";
import { notifyCardUpdated } from "@/lib/wallet/notify";
import type { Database, ProgramType } from "@/types/database";
import { referralSettings } from "./config";

/**
 * After a staff-scanned stamp/spend, pay the card's pending referral (if any).
 * pay_referral does claim + both grants in one transaction, so a second scan
 * (or a concurrent one) finds nothing pending. Call it BEFORE the scan reloads
 * the card so the response and the friend's pass already include the bonus;
 * the referrer's pass is refreshed here. Never throws: on any error the
 * referral stays pending and the next scan retries. Logs ids/codes only.
 */
export async function triggerReferralReward(
  admin: SupabaseClient<Database>,
  card: {
    id: string;
    business: { timezone: string };
    program: { type: ProgramType; config?: Record<string, unknown> | null };
  },
): Promise<void> {
  try {
    const settings = referralSettings(card.program.type, card.program.config);
    if (!settings) return;

    const { data: pending, error } = await admin
      .from("referrals")
      .select("id")
      .eq("referred_card_id", card.id)
      .eq("status", "pending")
      .maybeSingle();
    if (error) throw error;
    if (!pending) return;

    const { data, error: payError } = await admin.rpc("pay_referral", {
      p_referral_id: pending.id,
      p_referrer_bonus: settings.referrerBonus,
      p_friend_bonus: settings.referredBonus,
      p_monthly_cap: settings.monthlyCap,
      p_tz: card.business.timezone,
    });
    if (payError) throw payError;

    const paid = data?.[0];
    if (paid?.referrer_paid) {
      const referrer = await getCardById(admin, paid.referrer_card_id);
      if (referrer) await notifyCardUpdated(admin, referrer);
    }
  } catch (e) {
    console.error("[referrals] payout failed", {
      cardId: card.id,
      code: (e as { code?: string } | null)?.code,
    });
  }
}
