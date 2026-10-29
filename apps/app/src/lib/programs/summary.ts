import type { Card, Program } from "@/types/database";
import { DEFAULT_CURRENCY, oneOf } from "./currency";
import { interpolate } from "@stamply/i18n/format";
import type { Dictionary } from "@stamply/i18n/dictionaries";

export type SummaryDict = Dictionary["dashboard"]["programs"]["list"]["details"];
export interface Row {
  label: string;
  value: string;
}

type CardStats = Pick<
  Card,
  "program_id" | "rewards" | "points" | "points_redeemed" | "uses_count" | "valid_until"
>;

const n = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
// shortcut: "$" is hardcoded like the rest of the app (no currency field), add one when programs get a currency.
const money = (v: number) => `$${Number.isInteger(v) ? v : v.toFixed(2)}`;

/** How the program works, per card type — read from programs.config. */
export function programRules(p: Program, d: SummaryDict): Row[] {
  const c = (p.config ?? {}) as Record<string, unknown>;
  const tiers = (Array.isArray(c.tiers) ? c.tiers : []) as Record<string, unknown>[];

  switch (p.type) {
    case "stamp":
      return [
        { label: d.goal, value: interpolate(d.stampsValue, { goal: p.goal }) },
        { label: d.reward, value: p.reward_description },
      ];

    case "points": {
      const rate = n(c.points_per_unit) ?? 1;
      const earn =
        c.earn === "spend"
          ? interpolate(d.earnSpend, { points: rate, amount: oneOf(typeof c.currency === "string" ? c.currency : DEFAULT_CURRENCY) })
          : interpolate(d.earnVisit, { points: rate });
      const rewards =
        tiers.length > 0
          ? tiers
              .map((t) => `${t.points} pts → ${String(t.reward)}`)
              .join(" · ")
          : `${interpolate(d.pointsValue, { goal: p.goal })} → ${p.reward_description}`;
      return [
        { label: d.earn, value: earn },
        { label: tiers.length > 0 ? d.rewardTiers : d.reward, value: rewards },
      ];
    }

    case "coupon": {
      const value = n(c.value) ?? 0;
      const discount =
        c.discount_kind === "percent"
          ? `${value}%`
          : c.discount_kind === "fixed"
            ? money(value)
            : d.freeItem;
      const maxUses = n(c.max_uses);
      const validDays = n(c.valid_days);
      const minSpendCents = n(c.min_spend_cents);
      const rows: Row[] = [
        { label: d.offer, value: p.reward_description },
        { label: d.discount, value: discount },
        {
          label: d.uses,
          value: maxUses === null ? d.unlimited : interpolate(d.usesValue, { count: maxUses }),
        },
        {
          label: d.validity,
          value:
            validDays === null
              ? d.noExpiry
              : interpolate(d.validityValue, { days: validDays }),
        },
      ];
      if (minSpendCents) rows.push({ label: d.minSpend, value: money(minSpendCents / 100) });
      return rows;
    }

    case "membership": {
      const days = n(c.renew_days);
      const rows: Row[] = [
        {
          label: d.activation,
          value: c.access === "staff_activated" ? d.activationStaff : d.activationFree,
        },
      ];
      if (days) rows.push({ label: d.renewal, value: interpolate(d.renewalValue, { days }) });
      if (tiers.length > 0) {
        rows.push({ label: d.memberTiers, value: tiers.map((t) => String(t.name)).join(" · ") });
      }
      rows.push({ label: d.benefits, value: p.reward_description });
      return rows;
    }
  }
}

/** Live numbers for one program from its cards. `issued` is always first. */
export function programStats(
  p: Pick<Program, "id" | "type">,
  cards: CardStats[],
  d: SummaryDict,
  now: Date = new Date(),
): Row[] {
  const mine = cards.filter((c) => c.program_id === p.id);
  const sum = (f: (c: CardStats) => number) => mine.reduce((t, c) => t + f(c), 0);
  const rows: Row[] = [{ label: d.statCards, value: String(mine.length) }];

  switch (p.type) {
    case "stamp":
      rows.push({ label: d.statPendingRewards, value: String(sum((c) => c.rewards)) });
      break;
    case "points":
      rows.push({
        label: d.statPointsBalance,
        value: String(sum((c) => c.points - (c.points_redeemed ?? 0))),
      });
      break;
    case "coupon":
      rows.push({ label: d.statCouponUses, value: String(sum((c) => c.uses_count ?? 0)) });
      break;
    case "membership":
      rows.push({
        label: d.statActiveMembers,
        value: String(
          mine.filter((c) => c.valid_until && new Date(c.valid_until) > now).length,
        ),
      });
      break;
  }
  return rows;
}
