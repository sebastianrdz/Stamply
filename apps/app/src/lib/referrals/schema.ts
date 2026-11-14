import { z } from "zod";
import { REFERRAL_CAP_MAX } from "./config";

/** `programs.config.referral`: only stored when enabled (off = key absent). */
export const referralSchema = (maxBonus: number) =>
  z.object({
    enabled: z.literal(true),
    referrer_bonus: z.number().int().min(1).max(maxBonus),
    referred_bonus: z.number().int().min(0).max(maxBonus),
    monthly_cap: z.number().int().min(1).max(REFERRAL_CAP_MAX),
  });
