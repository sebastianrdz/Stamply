import Link from "next/link";
import { LanguageSelector } from "@stamply/i18n/language-selector";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";

export async function Footer() {
  const dict = await getDictionary(await getLocale());
  const { landing, legal } = dict;

  return (
    <footer className="border-border text-muted-foreground border-t px-6 py-8 text-center text-sm">
      <p>{landing.footer.rights}</p>
      <nav className="mt-3 flex flex-wrap items-center justify-center gap-4">
        <LanguageSelector />
        <Link href="/terms" className="hover:text-foreground hover:underline">
          {legal.nav.termsTitle}
        </Link>
        <Link href="/privacy" className="hover:text-foreground hover:underline">
          {legal.nav.privacyTitle}
        </Link>
      </nav>
    </footer>
  );
}
