"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  PAID_PLANS,
  annualMonthly,
  annualSavingsPct,
  type BillingInterval,
  type PlanTier,
} from "@stamply/plans";
import { changePlan } from "@/lib/billing/actions";
import { Button } from "@stamply/ui/button";
import { Card } from "@stamply/ui/card";
import { IntervalToggle } from "@stamply/ui/interval-toggle";
import { useLocale, useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";

function Subscribe({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {label}
    </Button>
  );
}

/**
 * First-run plan picker: selectable tiles (same pattern as the card-type page)
 * and a single primary button that starts checkout for the chosen plan.
 */
export function PlanChooser({ trialEligible }: { trialEligible: boolean }) {
  const dict = useTranslations();
  const locale = useLocale();
  const { pricing } = dict.landing;
  const [interval, setInterval] = useState<BillingInterval>("year");
  const [tier, setTier] = useState<PlanTier>(PAID_PLANS[0].tier);
  const annual = interval === "year";

  const money = new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  });

  const selected = PAID_PLANS.find((p) => p.tier === tier) ?? PAID_PLANS[0];
  const selectedName = dict.billing.plans[selected.tier].name;
  const cta = trialEligible
    ? `${dict.common.startTrial} · ${selectedName}`
    : interpolate(dict.common.subscribeTo, { name: selectedName });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div role="group" aria-label={pricing.intervalLabel}>
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

      <fieldset className="flex flex-col gap-2.5">
        <legend className="sr-only">
          {dict.dashboard.billing.plansHeading}
        </legend>
        {PAID_PLANS.map((p) => {
          const copy = dict.billing.plans[p.tier];
          return (
            <label
              key={p.tier}
              className="group border-border has-[:checked]:border-primary has-[:checked]:bg-muted has-[:focus-visible]:ring-ring flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-x-5 gap-y-1.5 rounded-xl border p-4 transition-colors duration-150 has-[:focus-visible]:ring-2"
            >
              <input
                type="radio"
                name="plan"
                value={p.tier}
                checked={tier === p.tier}
                onChange={() => setTier(p.tier)}
                className="sr-only"
              />
              <span className="flex min-w-0 flex-1 basis-56 items-start gap-3">
                {/* Background-based so the chosen plan is obvious without a border colour. */}
                <span
                  aria-hidden
                  className="group-has-[:checked]:bg-primary mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors duration-150"
                >
                  <span className="bg-primary-foreground size-2 scale-0 rounded-full transition-transform duration-150 group-has-[:checked]:scale-100" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{copy.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {copy.features.slice(0, 3).join(" · ")}
                  </span>
                </span>
              </span>
              <span className="flex flex-col sm:items-end sm:text-right">
                <span className="text-xl font-bold tracking-tight tabular-nums">
                  {money.format(annual ? annualMonthly(p.tier)! : p.price)}
                  <span className="text-muted-foreground ml-1.5 text-sm font-normal">
                    {pricing.currency}
                    {dict.common.perMonth}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {annual
                    ? interpolate(pricing.billedYear, {
                        total: money.format(p.annualTotal!),
                      })
                    : pricing.billedMonth}
                  {" · "}
                  {pricing.taxIncluded}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">
          {interpolate(dict.billing.includedIn, { name: selectedName })}
        </h2>
        <ul className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {dict.billing.plans[selected.tier].features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="text-success mt-0.5 size-4 shrink-0"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
      </Card>

      <form action={changePlan.bind(null, selected.tier, interval)}>
        <Subscribe label={cta} />
      </form>
    </div>
  );
}
