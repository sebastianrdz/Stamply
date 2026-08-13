import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

/** Current request's locale from the cookie, falling back to `defaultLocale`
 *  (Spanish) for first-time/no-cookie visitors. Memoized per request, same
 *  as `getUser`/`getActiveBusiness` in `@/lib/auth/session`. */
export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return value && isLocale(value) ? value : defaultLocale;
});
