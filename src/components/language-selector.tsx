"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import { useLocale, useTranslations } from "@/lib/i18n/provider";
import { locales, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/** Compact ES / EN segmented toggle. Calls the `setLocale` server action,
 *  which sets the locale cookie and revalidates the whole tree. Used on the
 *  Settings page and on the marketing landing page header. */
export function LanguageSelector({ className }: { className?: string }) {
  const locale = useLocale();
  const dict = useTranslations();
  const [pending, startTransition] = useTransition();

  const shortLabel: Record<Locale, string> = {
    es: dict.settings.language.spanishShort,
    en: dict.settings.language.englishShort,
  };
  const fullLabel: Record<Locale, string> = {
    es: dict.settings.language.spanish,
    en: dict.settings.language.english,
  };

  return (
    <div
      role="group"
      aria-label={dict.settings.language.title}
      className={cn(
        "bg-muted inline-flex items-center gap-1 rounded-lg p-1",
        className,
      )}
    >
      {locales.map((loc) => {
        const selected = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            aria-pressed={selected}
            aria-label={fullLabel[loc]}
            disabled={pending}
            onClick={() => {
              if (selected) return;
              startTransition(async () => {
                await setLocale(loc);
              });
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {shortLabel[loc]}
          </button>
        );
      })}
    </div>
  );
}
