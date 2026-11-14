import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Program } from "@/types/database";
import { referralSettings } from "./config";

/**
 * Link a just-enrolled NEW customer to the card whose invite code they used,
 * as a `pending` referral (paid on their first scanned stamp). Ignores, without
 * telling the friend, anything that isn't eligible: referrals off, no usable
 * email/phone, a phone already on file, an unknown code or one from another
 * program. Never throws and never blocks enrollment; logs ids/codes only.
 */
export async function recordReferral(
  admin: SupabaseClient<Database>,
  p: {
    program: Program;
    referralCode: string;
    customerId: string;
    cardId: string;
    /** The friend gave an email or a usable phone. */
    hasContact: boolean;
    /** Another customer of the business already has this phone. */
    phoneClash: boolean;
  },
): Promise<"recorded" | "ignored"> {
  try {
    if (
      !p.hasContact ||
      p.phoneClash ||
      !referralSettings(p.program.type, p.program.config)
    ) {
      return "ignored";
    }
    const { data: referrer, error: lookupError } = await admin
      .from("cards")
      .select("id, program_id")
      .eq("referral_code", p.referralCode)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!referrer || referrer.program_id !== p.program.id) return "ignored";

    const { error } = await admin.from("referrals").insert({
      business_id: p.program.business_id,
      program_id: p.program.id,
      referrer_card_id: referrer.id,
      referred_customer_id: p.customerId,
      referred_card_id: p.cardId,
    });
    if (error) {
      if (error.code === "23505") return "ignored";
      throw error;
    }
    return "recorded";
  } catch (e) {
    console.error("[referrals] record failed", {
      programId: p.program.id,
      code: (e as { code?: string } | null)?.code,
    });
    return "ignored";
  }
}
