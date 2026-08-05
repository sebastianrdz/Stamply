import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function NotFound() {
  const dict = await getDictionary(await getLocale());
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight">
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
