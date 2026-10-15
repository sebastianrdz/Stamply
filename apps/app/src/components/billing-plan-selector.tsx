"use client";

import { useState } from "react";
import {
  PAID_PLANS,
  annualMonthly,
  annualSavingsPct,
  type BillingInterval,
  type PlanTier,
} from "@stamply/plans";
import { changePlan } from "@/lib/billing/actions";
import { Button } from "@stamply/ui/button";
import { PricingPanel } from "@stamply/ui/pricing-panel";
import { useLocale, useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";

export function BillingPlanSelector({
  currentTier,
  currentInterval,
  trialEligible = false,
}: {
  currentTier: PlanTier;
  currentInterval: BillingInterval | null;
  /** True when the next Checkout starts with the 14 free days. */
  trialEligible?: boolean;
}) {
  const dict = useTranslations();
  const locale = useLocale();
  const { pricing } = dict.landing;
  const [interval, setInterval] = useState<BillingInterval>("year");
  const annual = interval === "year";

  const money = new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  });

  return (
    <PricingPanel
      interval={interval}
      onIntervalChange={setInterval}
      intervalLabel={pricing.intervalLabel}
      monthlyLabel={dict.common.monthly}
      annualLabel={dict.common.annual}
      annualHint={interpolate(dict.common.annualSave, {
        pct: annualSavingsPct("small"),
      })}
      plans={PAID_PLANS.map((p) => {
        const isCurrentExact =
          p.tier === currentTier && interval === currentInterval;
        const copy = dict.billing.plans[p.tier];
        return {
          id: p.tier,
          name: copy.name,
          tagline: copy.tagline,
          price: money.format(annual ? annualMonthly(p.tier)! : p.price),
          priceSuffix: `${pricing.currency}${dict.common.perMonth}`,
          billing: `${
            annual
              ? interpolate(pricing.billedYear, {
                  total: money.format(p.annualTotal!),
                })
              : pricing.billedMonth
          } · ${pricing.taxIncluded}`,
          features: copy.features,
          current: p.tier === currentTier,
          badge: isCurrentExact
            ? dict.dashboard.billing.currentPlan
            : undefined,
          action: (
            <form action={changePlan.bind(null, p.tier, interval)}>
              <Button
                type="submit"
                size="lg"
                variant={isCurrentExact ? "outline" : "primary"}
                className="w-full"
                disabled={isCurrentExact}
              >
                {isCurrentExact
                  ? dict.dashboard.billing.currentPlan
                  : trialEligible
                    ? dict.common.startTrial
                    : currentTier === "none"
                      ? interpolate(dict.common.subscribeTo, { name: copy.name })
                      : interpolate(dict.common.switchTo, { name: copy.name })}
              </Button>
            </form>
          ),
        };
      })}
    />
  );
}
