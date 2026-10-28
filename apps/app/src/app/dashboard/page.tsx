import Link from "next/link";
import { Users, CreditCard, Stamp, Gift, ScanLine, Plus, TrendingUp } from "lucide-react";
import { requireBusiness } from "@/lib/auth/session";
import { getOverviewStats } from "@/lib/stats";
import { getAnalytics, getCardBreakdown } from "@/lib/analytics";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { DashboardToastListener } from "./dashboard-toast-listener";

export default async function DashboardOverview() {
  const { membership } = await requireBusiness();
  const [stats, a, breakdown] = await Promise.all([
    getOverviewStats(membership.business.id),
    getAnalytics(membership.business.id),
    getCardBreakdown(membership.business.id),
  ]);
  const dict = await getDictionary(await getLocale());
  const overview = dict.dashboard.overview;
  const analytics = dict.dashboard.analytics;
  const byCard = dict.dashboard.marketing.byCard;
  const max = Math.max(1, ...a.daily.map((d) => d.stamps));

  return (
    <>
      <DashboardToastListener businessName={membership.business.name} />
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


      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={analytics.stats.stamps14d}
          value={a.totalStamps}
          icon={Stamp}
        />
        <StatCard
          label={analytics.stats.redemptionRate}
          value={`${Math.round(a.redemptionRate * 100)}%`}
          icon={TrendingUp}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{analytics.stampsPerDay}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-1.5">
            {a.daily.map((d) => (
              <div
                key={d.date}
                className="flex flex-1 flex-col items-center gap-1.5"
              >
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="bg-primary/80 hover:bg-primary w-full rounded-t transition-all"
                    style={{
                      height: `${(d.stamps / max) * 100}%`,
                      minHeight: d.stamps > 0 ? "4px" : "0",
                    }}
                    title={interpolate(analytics.stampsTooltip, {
                      count: d.stamps,
                    })}
                  />
                </div>
                <span className="text-muted-foreground text-[10px]">
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {breakdown.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{byCard.title}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="py-2 pr-4 font-medium">{dict.nav.cards}</th>
                  <th className="px-4 py-2 text-right font-medium">{byCard.customers}</th>
                  <th className="px-4 py-2 text-right font-medium">{byCard.cards}</th>
                  <th className="px-4 py-2 text-right font-medium">{byCard.stamps}</th>
                  <th className="py-2 pl-4 text-right font-medium">{byCard.redemptions}</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((r) => (
                  <tr key={r.programId} className="border-border border-t">
                    <td className="py-2 pr-4 font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-right">{r.customers}</td>
                    <td className="px-4 py-2 text-right">{r.cards}</td>
                    <td className="px-4 py-2 text-right">{r.stamps}</td>
                    <td className="py-2 pl-4 text-right">{r.redemptions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

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
              href="/dashboard/cards/new"
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
