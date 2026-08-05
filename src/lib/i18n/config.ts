export const locales = ["es", "en"] as const;

export type Locale = (typeof locales)[number];

/** Mexico-based product — Spanish is the default for everyone, cookie or not. */
export const defaultLocale: Locale = "es";

export const LOCALE_COOKIE = "stamply_locale";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
