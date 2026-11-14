import { z } from "zod";
import { locales } from "@stamply/i18n/config";
import { isValidTimezone } from "@/lib/timezones";
import { isReviewUrl } from "@/lib/reviews/url";

type Msgs = {
  businessNameRequired: string;
  supportEmailInvalid: string;
  supportPhoneInvalid: string;
  localeInvalid: string;
  timezoneInvalid: string;
  averageTicketInvalid: string;
  reviewUrlInvalid: string;
};

/** Empty string -> null so cleared inputs wipe the column. */
const optional = (s: z.ZodType<string>) =>
  z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v),
    s.nullable(),
  );

/** Pesos string ("120", "99.50") -> integer cents; null stays null. */
export function pesosToCents(pesos: string | null): number | null {
  return pesos === null ? null : Math.round(Number(pesos) * 100);
}

export function settingsSchema(m: Msgs) {
  return z.object({
    name: z.string().min(2, m.businessNameRequired).max(80),
    timezone: z.string().refine(isValidTimezone, m.timezoneInvalid),
    support_email: optional(
      z.string().trim().max(254).email(m.supportEmailInvalid),
    ),
    support_phone: optional(
      z
        .string()
        .trim()
        .max(32, m.supportPhoneInvalid)
        .regex(/^\+?[\d\s().-]{5,}$/, m.supportPhoneInvalid),
    ),
    locale: optional(z.enum(locales, { message: m.localeInvalid })),
    google_review_url: optional(
      z
        .string()
        .trim()
        .max(500, m.reviewUrlInvalid)
        .refine(isReviewUrl, m.reviewUrlInvalid),
    ),
    // Max 999,999.99 keeps cents within the column's check (<= 100,000,000).
    average_ticket: optional(
      z
        .string()
        .trim()
        .regex(/^\d{1,6}(\.\d{1,2})?$/, m.averageTicketInvalid)
        .refine((v) => Number(v) > 0, m.averageTicketInvalid),
    ),
  });
}
