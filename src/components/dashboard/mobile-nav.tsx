"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ScanLine, CreditCard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/scan", label: "Scan", icon: ScanLine },
  { href: "/dashboard/programs", label: "Programs", icon: CreditCard },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-30 flex border-t backdrop-blur md:hidden">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
