import Link from "next/link";
import {
  Users,
  CreditCard,
  Stamp,
  Gift,
  ScanLine,
  Plus,
  TrendingUp,
  Repeat,
  Percent,
  Banknote,
  Megaphone,
  CalendarClock,
  UserX,
} from "lucide-react";
import { requireBusiness } from "@/lib/auth/session";
import { getOverviewStats } from "@/lib/stats";
import { getAnalytics, getCardBreakdown, RANGES } from "@/lib/analytics";
import { getRoi } from "@/lib/roi";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { DashboardToastListener } from "./dashboard-toast-listener";

export default async function DashboardOverview({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { membership } = await requireBusiness();
  const { range } = await searchParams;
  const days = RANGES.find((r) => String(r) === range) ?? 30;
  const business = membership.business;
  const locale = await getLocale();
  const [stats, a, breakdown, roi] = await Promise.all([
    getOverviewStats(business.id),
    getAnalytics(business.id, business.timezone, days),
    getCardBreakdown(business.id, days),
    getRoi(await createClient(), business, days),
  ]);
  const dict = await getDictionary(locale);
  const overview = dict.dashboard.overview;
  const roiText = overview.roi;
  const analytics = dict.dashboard.analytics;
  const byCard = dict.dashboard.marketing.byCard;
  const max = Math.max(1, ...a.daily.map((d) => d.stamps));
  const mxn = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });

  return (
    <>
      <DashboardToastListener businessName={membership.business.name} />
      <PageHeader
        title={interpolate(overview.welcome, {
          business: membership.business.name,
        })}
        description={overview.description}
      />

      <nav
        aria-label={overview.range.label}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/dashboard?range=${r}`}
            aria-current={r === days ? "page" : undefined}
            className={buttonVariants({
              variant: r === days ? "primary" : "outline",
              size: "sm",
            })}
          >
            {overview.range[`${r}`]}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={roiText.returning}
          value={roi.returningCustomers}
          hint={interpolate(roiText.returningHint, {
            active: roi.activeCustomers,
          })}
          icon={Repeat}
        />
        <StatCard
          label={roiText.repeatRate}
          value={`${Math.round(roi.repeatRate * 100)}%`}
          icon={Percent}
        />
        {roi.estimatedRevenueCents === null ? (
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-lg">
                <Banknote className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-sm">
                  {roiText.revenue}
                </p>
                <Link
                  href="/dashboard/settings"
                  className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                >
                  {roiText.setTicketCta}
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <StatCard
            label={roiText.revenue}
            value={`≈ ${mxn.format(roi.estimatedRevenueCents / 100)}`}
            hint={roiText.revenueHint}
            icon={Banknote}
          />
        )}
        <StatCard
          label={roiText.fromMessages}
          value={roi.attributedVisits}
          hint={roiText.fromMessagesHint}
          icon={Megaphone}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          label={interpolate(analytics.stats.stampsPeriod, { days })}
          value={a.totalStamps}
          icon={Stamp}
        />
        <StatCard
          label={analytics.stats.redemptionRate}
          value={`${Math.round(a.redemptionRate * 100)}%`}
          icon={TrendingUp}
        />
        <StatCard
          label={roiText.avgDaysBetween}
          value={roi.avgDaysBetween ?? "—"}
          icon={CalendarClock}
        />
        <StatCard
          label={roiText.atRisk}
          value={roi.atRisk}
          hint={interpolate(roiText.atRiskHint, {
            from: roi.atRiskFromDays,
            to: roi.atRiskFromDays * 2,
          })}
          icon={UserX}
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
                {days <= 14 && (
                  <span className="text-muted-foreground text-[10px]">
                    {d.label}
                  </span>
                )}
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
