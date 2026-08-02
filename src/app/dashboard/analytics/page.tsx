import type { Metadata } from "next";
import { Stamp, Gift, CreditCard, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getAnalytics } from "@/lib/analytics";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const a = await getAnalytics(membership.business.id);
  const max = Math.max(1, ...a.daily.map((d) => d.stamps));

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How customers are engaging with your loyalty program."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Stamps (14d)" value={a.totalStamps} icon={Stamp} />
        <StatCard
          label="Cards issued"
          value={a.activeCards}
          icon={CreditCard}
        />
        <StatCard label="Redemptions" value={a.totalRedemptions} icon={Gift} />
        <StatCard
          label="Redemption rate"
          value={`${Math.round(a.redemptionRate * 100)}%`}
          icon={TrendingUp}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Stamps per day</CardTitle>
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
                    title={`${d.stamps} stamps`}
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
