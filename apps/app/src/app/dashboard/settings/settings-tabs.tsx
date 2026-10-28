"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@stamply/ui/utils";

export function SettingsTabs({
  tabs,
}: {
  tabs: { href: string; label: string; exact?: boolean }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="border-border mb-6 flex gap-1 border-b">
      {tabs.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
