import Link from "next/link";
import { Logo } from "@stamply/ui/logo";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground mt-2">
          The page you’re looking for doesn’t exist.
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants())}>
        Back home
      </Link>
    </div>
  );
}
