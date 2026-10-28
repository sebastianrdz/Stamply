import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { currentCount } from "@/lib/billing/entitlements";
import { PLANS, annualMonthly, type LimitedResource } from "@stamply/plans";
import { openBillingPortal } from "@/lib/billing/actions";
import { currentBillingInterval } from "@/lib/billing/stripe";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { Button } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { BillingToastListener } from "./billing-toast-listener";
import { BillingPlanSelector as PlanSelector } from "@/components/billing-plan-selector";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return { title: dict.dashboard.billing.metaTitle };
}

const RESOURCE_KEYS: LimitedResource[] = [
  "locations",
  "employees",
  "customers",
  "programs",
];

export default async function BillingPage() {
  const { membership } = await requireRole(["owner"]);
  const business = membership.business;
  const plan = PLANS[business.plan];
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  // Best-effort: which cadence the live subscription is on (for the summary +
  // to mark the exact current plan). Null when unknown / no subscription.
  const currentInterval = business.stripe_customer_id
    ? await currentBillingInterval(business.stripe_customer_id)
    : null;

  // During the 14 free days the subscription's period end is the trial end.
  let trialEnd: string | null = null;
  if (business.subscription_status === "trialing") {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("current_period_end")
      .eq("business_id", business.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    trialEnd = sub?.current_period_end ?? null;
  }

  const usage = await Promise.all(
    RESOURCE_KEYS.map(async (key) => ({
      key,
      label: dict.dashboard.billing.resources[key],
      count: await currentCount(supabase, business.id, key),
      limit: plan.limits[key],
    })),
  );

  return (
    <>
      <BillingToastListener />
      <PageHeader
        title={dict.dashboard.billing.title}
        description={dict.dashboard.billing.description}
      />

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>
              {dict.billing.plans[business.plan].name}{" "}
              {dict.dashboard.billing.planSuffix}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {currentInterval === "year"
                ? `$${annualMonthly(business.plan) ?? plan.price}${dict.common.perMonth} · ${dict.common.billedAnnually}`
                : `$${plan.price}${dict.common.perMonth} · ${dict.common.billedMonthly}`}{" "}
              · {dict.common.subscriptionStatus[business.subscription_status]}
              {trialEnd &&
                ` · ${interpolate(dict.dashboard.billing.freeUntil, {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                  }).format(new Date(trialEnd)),
                })}`}
            </p>
          </div>
          {business.stripe_customer_id && (
            <form action={openBillingPortal}>
              <Button variant="outline" size="sm">
                {dict.dashboard.billing.manageSubscription}
              </Button>
            </form>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {usage.map((u) => {
            const pct =
              u.limit == null ? 0 : Math.min(100, (u.count / u.limit) * 100);
            const near = u.limit != null && u.count / u.limit >= 0.8;
            return (
              <div key={u.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">{u.label}</span>
                  <span className="font-medium">
                    {u.count}
                    {u.limit == null ? "" : ` / ${u.limit}`}
                  </span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      near ? "bg-accent" : "bg-primary",
                      u.limit == null && "bg-success",
                    )}
                    style={{ width: u.limit == null ? "100%" : `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <h2 className="mb-4 text-lg font-semibold">
        {dict.dashboard.billing.plansHeading}
      </h2>
      <PlanSelector
        currentTier={business.plan}
        currentInterval={currentInterval}
      />
    </>
  );
}
