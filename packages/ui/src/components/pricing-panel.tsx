"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { IntervalToggle } from "./interval-toggle";

type Interval = "month" | "year";

export interface PricingPanelPlan {
  id: string;
  name: string;
  tagline: string;
  /** Pre-formatted price, e.g. "$679". */
  price: string;
  /** Suffix next to the price, e.g. "MXN / mes". */
  priceSuffix: string;
  /** Billing + tax line under the price. */
  billing: string;
  features: string[];
  /** CTA or form; rendered at the bottom of the card. */
  action: ReactNode;
  /** Small note under the action (e.g. trial terms). */
  note?: string;
  /** Emphasizes the card (the business's current plan). */
  current?: boolean;
  /** Small label beside the plan name (e.g. "Current plan"). */
  badge?: string;
}

/**
 * Shared pricing UI for the marketing site and the dashboard billing page:
 * interval toggle plus a bordered 3-column panel. Label-agnostic and
 * data-agnostic — callers pass localized, pre-formatted plans.
 */
export function PricingPanel({
  plans,
  interval,
  onIntervalChange,
  intervalLabel,
  monthlyLabel,
  annualLabel,
  annualHint,
  className,
}: {
  plans: PricingPanelPlan[];
  interval: Interval;
  onIntervalChange: (value: Interval) => void;
  intervalLabel: string;
  monthlyLabel: string;
  annualLabel: string;
  annualHint: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className="mb-10 flex justify-center"
        role="group"
        aria-label={intervalLabel}
      >
        <IntervalToggle
          value={interval}
          onChange={onIntervalChange}
          monthlyLabel={monthlyLabel}
          annualLabel={annualLabel}
          annualHint={annualHint}
        />
      </div>

      <div className="border-border bg-card grid divide-y overflow-hidden rounded-2xl border md:grid-cols-3 md:divide-x md:divide-y-0">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col gap-6 p-6 sm:p-8",
              plan.current && "bg-primary/5 ring-primary ring-1 ring-inset",
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.badge && (
                  <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {plan.tagline}
              </p>
            </div>
            <div>
              <p className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-4xl font-bold tracking-tight tabular-nums">
                  {plan.price}
                </span>
                <span className="text-muted-foreground text-sm">
                  {plan.priceSuffix}
                </span>
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {plan.billing}
              </p>
            </div>
            <ul className="border-border flex flex-col gap-2.5 border-t pt-5 text-sm">
              {plan.features.map((f) => (
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
            <div className="mt-auto">
              {plan.action}
              {plan.note && (
                <p className="text-muted-foreground mt-2 text-center text-xs">
                  {plan.note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
