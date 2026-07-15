import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireBusiness, getMemberships } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { Logo } from "@/components/brand/logo";
import { DashboardNav } from "@/components/dashboard/nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
import { Badge } from "@/components/ui/badge";
import { PLANS } from "@/lib/billing/plans";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { membership } = await requireBusiness();
  const memberships = await getMemberships();

  const options = memberships.map((m) => ({
    id: m.business.id,
    name: m.business.name,
    plan: m.business.plan,
  }));

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="border-border bg-card hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="p-4">
          <Link href="/dashboard" className="mb-4 flex px-2">
            <Logo />
          </Link>
          <BusinessSwitcher
            businesses={options}
            activeId={membership.business.id}
          />
        </div>
        <div className="flex-1 px-3">
          <DashboardNav />
        </div>
        <div className="border-border border-t p-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-muted-foreground text-xs">Plan</span>
            <Badge variant="secondary">
              {PLANS[membership.business.plan].name}
            </Badge>
          </div>
          <form action={signOut}>
            <button className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors">
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="border-border bg-background/95 sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur md:hidden">
        <Logo showText={false} />
        <div className="min-w-0 flex-1">
          <BusinessSwitcher
            businesses={options}
            activeId={membership.business.id}
          />
        </div>
        <form action={signOut}>
          <button
            aria-label="Sign out"
            className="text-muted-foreground hover:bg-muted grid size-9 place-items-center rounded-lg"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </header>

      <main className="flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      <MobileNav />
    </div>
  );
}
