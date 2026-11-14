import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RANGES } from "@/lib/analytics";
import { dailyFor, getEmployeeReport } from "@/lib/staff/report";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { buttonVariants } from "@stamply/ui/button";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.team.activity.metaTitle };
}

export default async function TeamActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; staff?: string }>;
}) {
  const { membership } = await requireRole(["owner", "admin"]);
  const { range, staff } = await searchParams;
  const days = RANGES.find((r) => String(r) === range) ?? 30;
  const business = membership.business;
  const dict = await getDictionary(await getLocale());
  const t = dict.dashboard.team.activity;

  const report = await getEmployeeReport(await createClient(), business, days);
  const selected = report.staff.find((s) => s.key === staff);
  const label = (name: string | null) => name ?? t.former;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <Link
            href="/dashboard/team"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t.back}
          </Link>
        }
      />

      <nav aria-label={t.rangeLabel} className="mb-4 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/dashboard/team/activity?range=${r}`}
            aria-current={r === days ? "page" : undefined}
            className={buttonVariants({
              variant: r === days ? "primary" : "outline",
              size: "sm",
            })}
          >
            {dict.dashboard.overview.range[`${r}`]}
          </Link>
        ))}
      </nav>

      {report.staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t.empty.title}
          description={t.empty.description}
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">{t.columns.staff}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t.columns.stamps}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t.columns.redemptions}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t.columns.overrides}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t.columns.activeDays}
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    {t.columns.perDay}
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.staff.map((s) => (
                  <tr
                    key={s.key}
                    className={`border-border border-t ${s.key === selected?.key ? "bg-muted/50" : ""}`}
                  >
                    <td className="px-5 py-3 font-medium">
                      <Link
                        href={`/dashboard/team/activity?range=${days}&staff=${s.key}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {label(s.name)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">{s.stamps}</td>
                    <td className="px-4 py-3 text-right">{s.redemptions}</td>
                    <td className="px-4 py-3 text-right">{s.overrides}</td>
                    <td className="px-4 py-3 text-right">{s.activeDays}</td>
                    <td className="px-5 py-3 text-right">
                      {s.stampsPerActiveDay}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {selected && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {interpolate(t.dailyTitle, { staff: label(selected.name) })}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">{t.columns.day}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t.columns.stamps}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t.columns.redemptions}
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    {t.columns.overrides}
                  </th>
                </tr>
              </thead>
              <tbody>
                {dailyFor(report.activity, selected.key).map((r) => (
                  <tr key={r.day} className="border-border border-t">
                    <td className="px-5 py-3">{r.day}</td>
                    <td className="px-4 py-3 text-right">{r.stamps}</td>
                    <td className="px-4 py-3 text-right">{r.redemptions}</td>
                    <td className="px-5 py-3 text-right">{r.overrides}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
