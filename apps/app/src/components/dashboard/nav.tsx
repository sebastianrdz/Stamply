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
  Settings,
  Megaphone,
  Zap,
  Printer,
  Activity,
} from "lucide-react";
import { cn } from "@stamply/ui/utils";
import { useTranslations } from "@stamply/i18n/provider";
import type { MembershipRole } from "@/types/database";

type NavKey =
  | "overview"
  | "scan"
  | "cards"
  | "customers"
  | "locations"
  | "broadcast"
  | "automations"
  | "marketing"
  | "activity"
  | "team"
  | "settings";

const staff: MembershipRole[] = ["owner", "admin"];

// `allow` lists the roles that may see an item; omit to allow everyone.
const items: {
  href: string;
  key: NavKey;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  allow?: MembershipRole[];
}[] = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/scan", key: "scan", icon: ScanLine },
  { href: "/dashboard/cards", key: "cards", icon: CreditCard, allow: staff },
  { href: "/dashboard/customers", key: "customers", icon: Users },
  { href: "/dashboard/locations", key: "locations", icon: MapPin, allow: staff },
  { href: "/dashboard/broadcast", key: "broadcast", icon: Megaphone, allow: staff },
  { href: "/dashboard/automations", key: "automations", icon: Zap, allow: staff },
  { href: "/dashboard/marketing", key: "marketing", icon: Printer, allow: staff },
  { href: "/dashboard/activity", key: "activity", icon: Activity, allow: staff },
  { href: "/dashboard/team", key: "team", icon: UserCog, allow: staff },
  // Everyone can open Settings; Business Profile and Plan & Billing inside are owner-only.
  { href: "/dashboard/settings", key: "settings", icon: Settings },
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
  const dict = useTranslations();
  const labelFor: Record<NavKey, string> = {
    overview: dict.nav.overview,
    scan: dict.nav.scan,
    cards: dict.nav.cards,
    customers: dict.nav.customers,
    locations: dict.nav.locations,
    broadcast: dict.nav.broadcast,
    automations: dict.nav.automations,
    marketing: dict.nav.marketing,
    activity: dict.nav.activity,
    team: dict.nav.team,
    settings: dict.nav.settings,
  };
  const visible = items.filter((i) => !i.allow || i.allow.includes(role));

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {visible.map(({ href, key, icon: Icon, exact }) => {
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
            {labelFor[key]}
            <NavLinkPendingHint />
          </Link>
        );
      })}
    </nav>
  );
}
