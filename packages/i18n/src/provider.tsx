"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries";

interface LocaleContextValue {
  locale: Locale;
  dict: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Makes the server-resolved locale + dictionary available to client
 *  components. Mounted once in the root layout. */
export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, dict }}>
      {children}
    </LocaleContext.Provider>
  );
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error(
      "useLocale/useTranslations must be used within <LocaleProvider>",
    );
  }
  return ctx;
}

/** Current locale ("es" | "en") in a client component. */
export function useLocale(): Locale {
  return useLocaleContext().locale;
}

/** Current dictionary in a client component, e.g. `useTranslations().nav.overview`. */
export function useTranslations(): Dictionary {
  return useLocaleContext().dict;
}
