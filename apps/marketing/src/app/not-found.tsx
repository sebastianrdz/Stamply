import Link from "next/link";
import { Logo } from "@stamply/ui/logo";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";

export default async function NotFound() {
  const dict = await getDictionary(await getLocale());
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">
          {dict.notFound.title}
        </h1>
        <p className="text-muted-foreground">{dict.notFound.description}</p>
      </div>
      <Link href="/" className={cn(buttonVariants())}>
        {dict.notFound.backHome}
      </Link>
    </div>
  );
}
