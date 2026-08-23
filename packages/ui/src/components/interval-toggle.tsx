"use client";

import { cn } from "../lib/utils";

type Interval = "month" | "year";

/**
 * Presentational Monthly/Annual segmented toggle. Label-agnostic — callers pass
 * localized strings — so it can be shared by the marketing and app pricing UIs.
 */
export function IntervalToggle({
  value,
  onChange,
  monthlyLabel,
  annualLabel,
  annualHint,
  className,
}: {
  value: Interval;
  onChange: (value: Interval) => void;
  monthlyLabel: string;
  annualLabel: string;
  /** Small savings hint shown on the Annual segment, e.g. "Save 17%". */
  annualHint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted inline-flex items-center rounded-full p-1",
        className,
      )}
    >
      {(["month", "year"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            value === v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v === "month" ? monthlyLabel : annualLabel}
          {v === "year" && annualHint && (
            <span className="text-success ml-1.5 text-xs font-semibold">
              {annualHint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
