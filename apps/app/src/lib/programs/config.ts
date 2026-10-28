import type { ProgramType } from "@/types/database";

/** Form-side (string) state for the per-type program settings. */
export interface ConfigDraft {
  earn: "visit" | "spend";
  pointsPerUnit: string;
  pointTiers: { points: string; reward: string }[];
  discountKind: "percent" | "fixed" | "item";
  value: string;
  maxUses: string; // "" = unlimited
  validDays: string; // "" = never expires
  minSpend: string; // currency units, "" = none
  access: "free" | "staff_activated";
  renewDays: string;
  memberTiers: { name: string; benefits: string }[];
  /** Stamp milestones. `iconUrl` is display state only: the server resolves icons from form fields. */
  milestones: {
    id: number;
    at: string;
    reward: string;
    iconUrl: string | null;
    /** Tint for this reward's icon; null = the icon's own colors. */
    iconColor: string | null;
  }[];
  rewardIconUrl: string | null;
  rewardIconColor: string | null;
}

export const MAX_TIERS = 10;

export const emptyDraft: ConfigDraft = {
  earn: "visit",
  pointsPerUnit: "1",
  pointTiers: [],
  discountKind: "percent",
  value: "10",
  maxUses: "1",
  validDays: "",
  minSpend: "",
  access: "free",
  renewDays: "30",
  memberTiers: [],
  milestones: [],
  rewardIconUrl: null,
  rewardIconColor: null,
};

let nextMilestoneId = 1;
export const newMilestoneId = () => nextMilestoneId++;

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** Draft -> the `programs.config` JSON the server action validates. */
export function buildConfig(
  type: ProgramType,
  d: ConfigDraft,
): Record<string, unknown> {
  switch (type) {
    case "stamp":
      // Rows are never filtered: the row index names its icon form field (ms_icon_{i}).
      return {
        ...(d.milestones.length > 0 && {
          milestones: d.milestones.map((m) => ({
            at: num(m.at),
            reward: m.reward.trim(),
            ...(m.iconColor && { icon_color: m.iconColor }),
          })),
        }),
        ...(d.rewardIconColor && { reward_icon_color: d.rewardIconColor }),
      };
    case "points": {
      const tiers = d.pointTiers
        .filter((t) => t.reward.trim() !== "")
        .map((t) => ({ points: num(t.points), reward: t.reward.trim() }));
      return {
        earn: d.earn,
        points_per_unit: num(d.pointsPerUnit),
        ...(tiers.length > 0 && { tiers }),
      };
    }
    case "coupon": {
      const min = num(d.minSpend);
      return {
        discount_kind: d.discountKind,
        value: d.discountKind === "item" ? 0 : num(d.value),
        max_uses: d.maxUses.trim() === "" ? null : num(d.maxUses),
        valid_days: d.validDays.trim() === "" ? null : num(d.validDays),
        ...(!Number.isNaN(min) &&
          min > 0 && { min_spend_cents: Math.round(min * 100) }),
      };
    }
    case "membership":
      return {
        access: d.access,
        renew_days: num(d.renewDays),
        tiers: d.memberTiers
          .filter((t) => t.name.trim() !== "")
          .map((t) => ({ name: t.name.trim(), benefits: t.benefits.trim() })),
      };
  }
}

/** Saved `programs.config` -> draft (falls back to defaults per field). */
export function draftFromConfig(
  config: Record<string, unknown> | undefined,
): ConfigDraft {
  const c = config ?? {};
  const s = (v: unknown, fallback = "") =>
    v === null || v === undefined ? fallback : String(v);
  const arr = (v: unknown) =>
    Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  return {
    earn: c.earn === "spend" ? "spend" : "visit",
    pointsPerUnit: s(c.points_per_unit, emptyDraft.pointsPerUnit),
    pointTiers: arr(c.tiers).map((t) => ({
      points: s(t.points),
      reward: s(t.reward),
    })),
    discountKind:
      c.discount_kind === "fixed" || c.discount_kind === "item"
        ? c.discount_kind
        : "percent",
    value: s(c.value, emptyDraft.value),
    maxUses: "max_uses" in c ? s(c.max_uses) : emptyDraft.maxUses,
    validDays: s(c.valid_days),
    minSpend:
      typeof c.min_spend_cents === "number"
        ? String(c.min_spend_cents / 100)
        : "",
    access: c.access === "staff_activated" ? "staff_activated" : "free",
    renewDays: s(c.renew_days, emptyDraft.renewDays),
    memberTiers: arr(c.tiers).map((t) => ({
      name: s(t.name),
      benefits: s(t.benefits),
    })),
    milestones: arr(c.milestones).map((m) => ({
      id: newMilestoneId(),
      at: s(m.at),
      reward: s(m.reward),
      iconUrl: typeof m.icon_url === "string" ? m.icon_url : null,
      iconColor: typeof m.icon_color === "string" ? m.icon_color : null,
    })),
    rewardIconUrl:
      typeof c.reward_icon_url === "string" ? c.reward_icon_url : null,
    rewardIconColor:
      typeof c.reward_icon_color === "string" ? c.reward_icon_color : null,
  };
}
