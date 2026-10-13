"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PAID_PLANS,
  annualMonthly,
  annualSavingsPct,
  type BillingInterval,
} from "@stamply/plans";
import { buttonVariants } from "@stamply/ui/button";
import { PricingPanel } from "@stamply/ui/pricing-panel";
import { cn } from "@stamply/ui/utils";
import { useLocale, useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";

export function PricingPlans({ appUrl }: { appUrl: string }) {
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
      plans={PAID_PLANS.map((plan) => {
        const copy = dict.billing.plans[plan.tier];
        return {
          id: plan.tier,
          name: copy.name,
          tagline: copy.tagline,
          price: money.format(annual ? annualMonthly(plan.tier)! : plan.price),
          priceSuffix: `${pricing.currency}${dict.common.perMonth}`,
          billing: `${
            annual
              ? interpolate(pricing.billedYear, {
                  total: money.format(plan.annualTotal!),
                })
              : pricing.billedMonth
          } · ${pricing.taxIncluded}`,
          features: copy.features,
          note: pricing.trial,
          action: (
            <Link
              href={`${appUrl}/register`}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              {pricing.cta}
            </Link>
          ),
        };
      })}
    />
  );
}
