import type { Metadata } from "next";
import { Check } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { currentCount } from "@/lib/billing/entitlements";
import { PLANS, PAID_PLANS, type LimitedResource } from "@/lib/billing/plans";
import { startCheckout, openBillingPortal } from "@/lib/billing/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

const RESOURCES: { key: LimitedResource; label: string }[] = [
  { key: "locations", label: "Locations" },
  { key: "employees", label: "Employees" },
  { key: "customers", label: "Customers" },
  { key: "programs", label: "Programs" },
];

export default async function BillingPage() {
  const { membership } = await requireRole(["owner"]);
  const business = membership.business;
  const plan = PLANS[business.plan];
  const supabase = await createClient();

  const usage = await Promise.all(
    RESOURCES.map(async (r) => ({
      ...r,
      count: await currentCount(supabase, business.id, r.key),
      limit: plan.limits[r.key],
    })),
  );

  return (
    <>
      <PageHeader
        title="Plan & billing"
        description="Manage your subscription and see your usage."
      />

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>{plan.name} plan</CardTitle>
            <p className="text-muted-foreground text-sm">
              {plan.price > 0
                ? `$${plan.price}/mo · billed monthly`
                : "Free trial"}{" "}
              · {business.subscription_status}
            </p>
          </div>
          {business.stripe_customer_id && (
            <form action={openBillingPortal}>
              <Button variant="outline" size="sm">
                Manage subscription
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

      <h2 className="mb-4 text-lg font-semibold">Plans</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {PAID_PLANS.map((p) => {
          const current = p.tier === business.plan;
          return (
            <Card
              key={p.tier}
              className={cn(current && "border-primary ring-primary ring-1")}
            >
              <CardContent className="flex h-full flex-col gap-5 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {current && <Badge>Current</Badge>}
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${p.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-muted-foreground text-xs">Billed monthly</p>
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="text-success size-4 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <form
                  action={startCheckout.bind(null, p.tier)}
                  className="mt-auto"
                >
                  <Button
                    type="submit"
                    variant={current ? "outline" : "primary"}
                    className="w-full"
                    disabled={current}
                  >
                    {current ? "Current plan" : `Switch to ${p.name}`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
