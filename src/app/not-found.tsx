import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">
          This card or page doesn&apos;t exist, or the link has expired.
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants())}>
        Back home
      </Link>
    </div>
  );
}
