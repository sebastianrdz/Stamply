"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  PAID_PLANS,
  annualMonthly,
  annualSavingsPct,
  type BillingInterval,
} from "@stamply/plans";
import { Card, CardContent } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import { buttonVariants } from "@stamply/ui/button";
import { IntervalToggle } from "@stamply/ui/interval-toggle";
import { cn } from "@stamply/ui/utils";
import { useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";

export function PricingPlans({ appUrl }: { appUrl: string }) {
  const dict = useTranslations();
  const [interval, setInterval] = useState<BillingInterval>("year");
  const annual = interval === "year";

  return (
    <>
      <div className="mb-8 flex justify-center">
        <IntervalToggle
          value={interval}
          onChange={setInterval}
          monthlyLabel={dict.common.monthly}
          annualLabel={dict.common.annual}
          annualHint={interpolate(dict.common.annualSave, {
            pct: annualSavingsPct("small"),
          })}
        />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {PAID_PLANS.map((plan) => {
          const planCopy = dict.billing.plans[plan.tier];
          const price = annual ? annualMonthly(plan.tier)! : plan.price;
          const popular = plan.tier === "medium";
          return (
            <Card
              key={plan.tier}
              className={cn(
                popular && "border-primary ring-primary shadow-md ring-1",
              )}
            >
              <CardContent className="flex h-full flex-col gap-5 p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{planCopy.name}</h3>
                    {popular && <Badge>{dict.billing.plans.mostPopular}</Badge>}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {planCopy.tagline}
                  </p>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">
                      ${price}
                    </span>
                    <span className="text-muted-foreground">
                      {dict.common.perMonth}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {annual
                      ? dict.common.billedAnnually
                      : dict.common.billedMonthly}
                  </p>
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  {planCopy.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="text-success size-4 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`${appUrl}/register`}
                  className={cn(
                    buttonVariants({
                      variant: popular ? "primary" : "outline",
                    }),
                    "mt-auto w-full",
                  )}
                >
                  {dict.landing.pricing.cta}
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
