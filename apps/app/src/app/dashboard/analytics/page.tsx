import type { Metadata } from "next";
import { Stamp, Gift, CreditCard, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getAnalytics } from "@/lib/analytics";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.analytics.metaTitle };
}

export default async function AnalyticsPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const a = await getAnalytics(membership.business.id);
  const dict = await getDictionary(await getLocale());
  const analytics = dict.dashboard.analytics;
  const max = Math.max(1, ...a.daily.map((d) => d.stamps));

  return (
    <>
      <PageHeader title={analytics.title} description={analytics.description} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={analytics.stats.stamps14d}
          value={a.totalStamps}
          icon={Stamp}
        />
        <StatCard
          label={analytics.stats.cardsIssued}
          value={a.activeCards}
          icon={CreditCard}
        />
        <StatCard
          label={analytics.stats.redemptions}
          value={a.totalRedemptions}
          icon={Gift}
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
    </>
  );
}
