"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
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
  const count = (n: number | null) =>
    n === null ? pricing.unlimited : new Intl.NumberFormat(tag).format(n);

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
          const rows = [
            [pricing.locations, plan.limits.locations],
            [pricing.customers, plan.limits.customers],
            [pricing.employees, plan.limits.employees],
          ] as const;
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
              <dl className="border-border divide-border divide-y border-y text-sm">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular-nums">{count(value)}</dd>
                  </div>
                ))}
              </dl>
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

      <details className="group border-border mt-6 border-b">
        <summary className="focus-visible:ring-ring flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-md text-sm font-medium focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          {pricing.compare}
          <ChevronDown className="size-4 transition-transform duration-150 group-open:rotate-180" />
        </summary>
        <div className="grid gap-8 pt-2 pb-8 md:grid-cols-3">
          {PAID_PLANS.map((plan) => {
            const copy = dict.billing.plans[plan.tier];
            return (
              <div key={plan.tier}>
                <h4 className="text-sm font-semibold">
                  {copy.name} · {pricing.compareIncludes}
                </h4>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {copy.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="text-success mt-0.5 size-4 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </details>
    </>
  );
}
