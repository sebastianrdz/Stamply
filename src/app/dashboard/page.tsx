import Link from "next/link";
import { Users, CreditCard, Stamp, Gift, ScanLine, Plus } from "lucide-react";
import { requireBusiness } from "@/lib/auth/session";
import { getOverviewStats } from "@/lib/stats";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { interpolate } from "@/lib/i18n/format";

export default async function DashboardOverview() {
  const { membership } = await requireBusiness();
  const stats = await getOverviewStats(membership.business.id);
  const dict = await getDictionary(await getLocale());
  const overview = dict.dashboard.overview;

  return (
    <>
      <PageHeader
        title={interpolate(overview.welcome, {
          business: membership.business.name,
        })}
        description={overview.description}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={overview.stats.customers}
          value={stats.customers}
          icon={Users}
        />
        <StatCard
          label={overview.stats.activeCards}
          value={stats.activeCards}
          icon={CreditCard}
        />
        <StatCard
          label={overview.stats.stampsThisWeek}
          value={stats.stampsThisWeek}
          icon={Stamp}
        />
        <StatCard
          label={overview.stats.rewardsRedeemed}
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
                <h3 className="font-semibold">{overview.scanCard.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {overview.scanCard.description}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/scan"
              className={cn(buttonVariants({ variant: "primary" }), "w-full")}
            >
              {overview.scanCard.cta}
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
                <h3 className="font-semibold">
                  {overview.newProgramCard.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {overview.newProgramCard.description}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/programs/new"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              {overview.newProgramCard.cta}
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
