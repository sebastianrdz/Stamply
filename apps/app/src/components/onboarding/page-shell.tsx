import Link from "next/link";
import { Logo } from "@stamply/ui/logo";
import { cn } from "@stamply/ui/utils";

const linkClass =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring -mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none";

/** Frame for the one-decision-per-page card setup screens. */
export function OnboardingPageShell({
  title,
  subtitle,
  backHref,
  backLabel,
  skipHref,
  skipLabel,
  wide = false,
  children,
}: {
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  skipHref?: string;
  skipLabel?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="p-6">
        <Logo />
      </header>
      <main className="flex flex-1 justify-center px-6 pb-16">
        <div
          className={cn(
            "onboarding-enter w-full",
            wide ? "max-w-5xl" : "max-w-2xl",
          )}
        >
          {backHref && (
            <Link href={backHref} className={cn(linkClass, "mb-2")}>
              {backLabel}
            </Link>
          )}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-muted-foreground text-sm">{subtitle}</p>
            </div>
            {skipHref && (
              <Link href={skipHref} className={linkClass}>
                {skipLabel}
              </Link>
            )}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
