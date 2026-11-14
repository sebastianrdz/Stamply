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
  // Why a referral didn't count is otherwise invisible to the owner; log the
  // reason (never the code, email or phone).
  const ignore = (reason: string) => {
    console.warn("[referrals] ignored", { programId: p.program.id, reason });
    return "ignored" as const;
  };
  try {
    if (!referralSettings(p.program.type, p.program.config))
      return ignore("referrals_off");
    if (!p.hasContact) return ignore("no_contact");
    if (p.phoneClash) return ignore("phone_already_on_file");
    const { data: referrer, error: lookupError } = await admin
      .from("cards")
      .select("id, program_id")
      .eq("referral_code", p.referralCode)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!referrer) return ignore("unknown_code");
    if (referrer.program_id !== p.program.id) return ignore("other_program");

    const { error } = await admin.from("referrals").insert({
      business_id: p.program.business_id,
      program_id: p.program.id,
      referrer_card_id: referrer.id,
      referred_customer_id: p.customerId,
      referred_card_id: p.cardId,
    });
    if (error) {
      if (error.code === "23505") return ignore("already_referred");
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
