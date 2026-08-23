"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  PAID_PLANS,
  annualMonthly,
  annualSavingsPct,
  type BillingInterval,
  type PlanTier,
} from "@stamply/plans";
import { changePlan } from "@/lib/billing/actions";
import { Card, CardContent } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import { Button } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { IntervalToggle } from "@stamply/ui/interval-toggle";
import { useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";

export function PlanSelector({
  currentTier,
  currentInterval,
}: {
  currentTier: PlanTier;
  currentInterval: BillingInterval | null;
}) {
  const dict = useTranslations();
  const [interval, setInterval] = useState<BillingInterval>("year");
  const annual = interval === "year";

  return (
    <>
      <div className="mb-4 flex justify-center">
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
        {PAID_PLANS.map((p) => {
          const isCurrentTier = p.tier === currentTier;
          const isCurrentExact = isCurrentTier && interval === currentInterval;
          const planCopy = dict.billing.plans[p.tier];
          const price = annual ? annualMonthly(p.tier)! : p.price;
          return (
            <Card
              key={p.tier}
              className={cn(
                isCurrentTier && "border-primary ring-primary ring-1",
              )}
            >
              <CardContent className="flex h-full flex-col gap-5 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{planCopy.name}</h3>
                  {isCurrentExact && (
                    <Badge>{dict.dashboard.billing.currentPlan}</Badge>
                  )}
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${price}</span>
                    <span className="text-muted-foreground">
                      {dict.common.perMonth}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
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
                <form
                  action={changePlan.bind(null, p.tier, interval)}
                  className="mt-auto"
                >
                  <Button
                    type="submit"
                    variant={isCurrentExact ? "outline" : "primary"}
                    className="w-full"
                    disabled={isCurrentExact}
                  >
                    {isCurrentExact
                      ? dict.dashboard.billing.currentPlan
                      : interpolate(dict.common.switchTo, {
                          name: planCopy.name,
                        })}
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
