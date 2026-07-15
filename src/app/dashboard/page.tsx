import Link from "next/link";
import { Users, CreditCard, Stamp, Gift, ScanLine, Plus } from "lucide-react";
import { requireBusiness } from "@/lib/auth/session";
import { getOverviewStats } from "@/lib/stats";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardOverview() {
  const { membership } = await requireBusiness();
  const stats = await getOverviewStats(membership.business.id);

  return (
    <>
      <PageHeader
        title={`Welcome, ${membership.business.name}`}
        description="Here's how your loyalty program is doing."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Customers" value={stats.customers} icon={Users} />
        <StatCard
          label="Active cards"
          value={stats.activeCards}
          icon={CreditCard}
        />
        <StatCard
          label="Stamps this week"
          value={stats.stampsThisWeek}
          icon={Stamp}
        />
        <StatCard
          label="Rewards redeemed"
          value={stats.redemptions}
          icon={Gift}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary grid size-10 place-items-center rounded-lg">
                <ScanLine className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">Scan a card</h3>
                <p className="text-muted-foreground text-sm">
                  Add a stamp or redeem a reward.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/scan"
              className={cn(buttonVariants({ variant: "primary" }), "w-full")}
            >
              Open scanner
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex items-center gap-3">
              <div className="bg-accent/15 text-accent-foreground grid size-10 place-items-center rounded-lg">
                <Plus className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">New program</h3>
                <p className="text-muted-foreground text-sm">
                  Create a stamp card or points reward.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/programs/new"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Create program
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
