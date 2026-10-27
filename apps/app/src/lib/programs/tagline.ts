import type { Program } from "@/types/database";
import type { Dictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";

/** One-line "what is this card" copy, per type (join page, program detail). */
export function programTagline(
  p: Pick<Program, "type" | "goal"> & Partial<Pick<Program, "config">>,
  t: Dictionary["programTagline"],
): string {
  const c = (p.config ?? {}) as Record<string, unknown>;
  switch (p.type) {
    case "stamp":
      return interpolate(t.stamp, { goal: p.goal });
    case "points":
      return Array.isArray(c.tiers) && c.tiers.length > 0
        ? t.pointsTiers
        : interpolate(t.points, { goal: p.goal });
    case "coupon":
      return c.discount_kind === "percent"
        ? interpolate(t.couponPercent, { value: String(c.value) })
        : c.discount_kind === "fixed"
          ? interpolate(t.couponFixed, { value: String(c.value) })
          : t.couponItem;
    case "membership":
      return t.membership;
  }
}
