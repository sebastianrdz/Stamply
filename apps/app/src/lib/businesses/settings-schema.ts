import { z } from "zod";
import { locales } from "@stamply/i18n/config";

type Msgs = {
  businessNameRequired: string;
  supportEmailInvalid: string;
  supportPhoneInvalid: string;
  localeInvalid: string;
};

/** Empty string -> null so cleared inputs wipe the column. */
const optional = (s: z.ZodType<string>) =>
  z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v),
    s.nullable(),
  );

export function settingsSchema(m: Msgs) {
  return z.object({
    name: z.string().min(2, m.businessNameRequired).max(80),
    timezone: z.string().min(1).max(64),
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
  });
}
