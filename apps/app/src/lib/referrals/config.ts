import type { ProgramType } from "@/types/database";

export const REFERRAL_CAP_MAX = 20;
export const REFERRAL_CAP_DEFAULT = 5;

/** Referral bonuses only exist where a card has a balance to add to. */
export const supportsReferrals = (type: string): type is "stamp" | "points" =>
  type === "stamp" || type === "points";

export const bonusMax = (type: ProgramType) => (type === "points" ? 500 : 5);
export const bonusDefault = (type: ProgramType) => (type === "points" ? 10 : 1);

export interface ReferralSettings {
  referrerBonus: number;
  referredBonus: number;
  monthlyCap: number;
}

const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
    ? v
    : fallback;

/** The program's referral settings, or null when referrals are off or unsupported. */
export function referralSettings(
  type: ProgramType,
  config: Record<string, unknown> | null | undefined,
): ReferralSettings | null {
  const r = config?.referral as Record<string, unknown> | undefined;
  if (!supportsReferrals(type) || !r || r.enabled !== true) return null;
  const max = bonusMax(type);
  return {
    referrerBonus: int(r.referrer_bonus, 1, max, bonusDefault(type)),
    referredBonus: int(r.referred_bonus, 0, max, bonusDefault(type)),
    monthlyCap: int(r.monthly_cap, 1, REFERRAL_CAP_MAX, REFERRAL_CAP_DEFAULT),
  };
}
