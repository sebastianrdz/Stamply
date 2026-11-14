import type { ProgramType } from "@/types/database";
import { referralSettings } from "./config";
import { enrollUrl } from "@/lib/urls";

/** The public invite link for a card; the code is NOT the wallet pass token. */
export function referralLink(programId: string, code: string): string {
  return `${enrollUrl(programId)}?ref=${code}`;
}

/** The card's invite link when its program has referrals on, else null. */
export function inviteUrlFor(card: {
  program_id: string;
  referral_code?: string;
  program: { type: ProgramType; config?: Record<string, unknown> | null };
}): string | null {
  const code = card.referral_code;
  return code && referralSettings(card.program.type, card.program.config)
    ? referralLink(card.program_id, code)
    : null;
}
