"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ScanLine,
  CreditCard,
  Users,
  UserCog,
  MapPin,
  BarChart3,
  Settings,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MembershipRole } from "@/types/database";

// `allow` lists the roles that may see an item; omit to allow everyone.
const items: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  allow?: MembershipRole[];
}[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/scan", label: "Scan", icon: ScanLine },
  {
    href: "/dashboard/programs",
    label: "Programs",
    icon: CreditCard,
    allow: ["owner", "admin"],
  },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  {
    href: "/dashboard/locations",
    label: "Locations",
    icon: MapPin,
    allow: ["owner", "admin"],
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
    allow: ["owner", "admin"],
  },
  {
    href: "/dashboard/team",
    label: "Team",
    icon: UserCog,
    allow: ["owner", "admin"],
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: Receipt,
    allow: ["owner"],
  },
  // Everyone can open Settings; only the owner sees the Business Profile inside.
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/** Tiny inline dot that fades in only if navigation is still pending after
 * ~100ms, so fast (prefetched) transitions don't flash it. Must render as a
 * descendant of the `<Link>` it reports on — see next/link's useLinkStatus. */
function NavLinkPendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto size-1.5 shrink-0 rounded-full bg-current transition-opacity delay-100 duration-200 motion-reduce:transition-none",
        pending
          ? "animate-pulse opacity-60 motion-reduce:animate-none"
          : "opacity-0",
      )}
    />
  );
}

export function DashboardNav({
  role,
  className,
}: {
  role: MembershipRole;
  className?: string;
}) {
  const pathname = usePathname();
  const visible = items.filter((i) => !i.allow || i.allow.includes(role));

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {visible.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
            <NavLinkPendingHint />
          </Link>
        );
      })}
    </nav>
  );
}
