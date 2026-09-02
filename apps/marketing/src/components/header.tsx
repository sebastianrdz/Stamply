import Link from "next/link";
import { Logo } from "@stamply/ui/logo";
import { buttonVariants } from "@stamply/ui/button";
import { LanguageSelector } from "@stamply/i18n/language-selector";
import { cn } from "@stamply/ui/utils";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function Header() {
  const dict = await getDictionary(await getLocale());
  const { landing } = dict;

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4">
      <Logo />
      <nav className="flex items-center gap-2">
        <LanguageSelector className="mr-1" />
        <Link
          href={`${appUrl}/login`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          {landing.nav.signIn}
        </Link>
        <Link href={`${appUrl}/register`} className={cn(buttonVariants({ size: "sm" }))}>
          {landing.nav.getStarted}
        </Link>
      </nav>
    </header>
  );
}
