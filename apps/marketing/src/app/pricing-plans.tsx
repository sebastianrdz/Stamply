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
import { buttonVariants } from "@stamply/ui/button";
import { IntervalToggle } from "@stamply/ui/interval-toggle";
import { cn } from "@stamply/ui/utils";
import { useLocale, useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";

export function PricingPlans({ appUrl }: { appUrl: string }) {
  const dict = useTranslations();
  const locale = useLocale();
  const { pricing } = dict.landing;
  const [interval, setInterval] = useState<BillingInterval>("year");
  const annual = interval === "year";

  const tag = locale === "es" ? "es-MX" : "en-US";
  const money = new Intl.NumberFormat(tag, {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  });

  return (
    <>
      <div
        className="mb-10 flex justify-center"
        role="group"
        aria-label={pricing.intervalLabel}
      >
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

      <div className="border-border bg-card grid divide-y overflow-hidden rounded-2xl border md:grid-cols-3 md:divide-x md:divide-y-0">
        {PAID_PLANS.map((plan) => {
          const copy = dict.billing.plans[plan.tier];
          const price = annual ? annualMonthly(plan.tier)! : plan.price;
          return (
            <div key={plan.tier} className="flex flex-col gap-6 p-6 sm:p-8">
              <div>
                <h3 className="text-lg font-semibold">{copy.name}</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {copy.tagline}
                </p>
              </div>
              <div>
                <p className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-4xl font-bold tracking-tight tabular-nums">
                    {money.format(price)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {pricing.currency}
                    {dict.common.perMonth}
                  </span>
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {annual
                    ? interpolate(pricing.billedYear, {
                        total: money.format(plan.annualTotal!),
                      })
                    : pricing.billedMonth}
                  {" · "}
                  {pricing.taxIncluded}
                </p>
              </div>
              <ul className="border-border flex flex-col gap-2.5 border-t pt-5 text-sm">
                {copy.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="text-success mt-0.5 size-4 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <Link
                  href={`${appUrl}/register`}
                  className={cn(buttonVariants({ size: "lg" }), "w-full")}
                >
                  {pricing.cta}
                </Link>
                <p className="text-muted-foreground mt-2 text-center text-xs">
                  {pricing.trial}
                </p>
              </div>
            </div>
          );
        })}
      </div>

    </>
  );
}
