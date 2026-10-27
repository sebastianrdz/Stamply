import type { Card, Program } from "@/types/database";

export type ScanAction =
  | "stamp"
  | "spend"
  | "redeem"
  | "redeem_tier"
  | "use_coupon"
  | "check_in"
  | "renew";

export interface PointsTier {
  points: number;
  reward: string;
}

/**
 * Type-agnostic view of a card. Returns facts, not copy, so the scanner, the
 * card page and both wallet passes format it with their own i18n.
 * Expiry is derived from `now` at read time — no cron, no status values.
 */
export interface CardState {
  type: Program["type"];
  /** Stamp/points: remainder toward the next goal (`total % goal`). */
  progress: number;
  goal: number;
  /** Points: spendable balance. */
  available: number;
  /** Points: next unaffordable tier, if any. */
  nextTier: PointsTier | null;
  /** Coupon: remaining uses, null = unlimited. */
  usesLeft: number | null;
  /** Coupon expires_at / membership valid_until. */
  until: string | null;
  tier: string | null;
  expired: boolean;
  actions: ScanAction[];
}

type CardIn = Pick<Card, "stamps" | "points" | "rewards"> &
  Partial<
    Pick<Card, "points_redeemed" | "uses_count" | "expires_at" | "tier" | "valid_until">
  >;
type ProgramIn = Pick<Program, "type" | "goal"> & Partial<Pick<Program, "config">>;

export function cardState(
  card: CardIn,
  program: ProgramIn,
  now: Date = new Date(),
): CardState {
  const goal = program.goal > 0 ? program.goal : 1;
  const config = program.config ?? {};
  const base: CardState = {
    type: program.type,
    progress: 0,
    goal,
    available: 0,
    nextTier: null,
    usesLeft: null,
    until: null,
    tier: card.tier ?? null,
    expired: false,
    actions: [],
  };
  const past = (iso: string | null | undefined) =>
    !!iso && new Date(iso).getTime() < now.getTime();

  switch (program.type) {
    case "stamp":
      return {
        ...base,
        progress: card.stamps % goal,
        actions: card.rewards > 0 ? ["stamp", "redeem"] : ["stamp"],
      };

    case "points": {
      const tiers = (Array.isArray(config.tiers) ? config.tiers : []) as PointsTier[];
      const available = card.points - (card.points_redeemed ?? 0);
      const earn: ScanAction = config.earn === "spend" ? "spend" : "stamp";
      // No tiers configured = legacy single goal, banked in cards.rewards.
      if (tiers.length === 0) {
        return {
          ...base,
          available,
          progress: card.points % goal,
          actions: card.rewards > 0 ? [earn, "redeem"] : [earn],
        };
      }
      const sorted = [...tiers].sort((a, b) => a.points - b.points);
      return {
        ...base,
        available,
        nextTier: sorted.find((t) => t.points > available) ?? null,
        actions: sorted.some((t) => t.points <= available)
          ? [earn, "redeem_tier"]
          : [earn],
      };
    }

    case "coupon": {
      const raw = config.max_uses;
      const max = typeof raw === "number" ? raw : null;
      const usesLeft = max === null ? null : Math.max(0, max - (card.uses_count ?? 0));
      const expired = past(card.expires_at);
      return {
        ...base,
        usesLeft,
        until: card.expires_at ?? null,
        expired,
        actions: expired || usesLeft === 0 ? [] : ["use_coupon"],
      };
    }

    case "membership": {
      // No valid_until yet = pending activation, same as expired for scanning.
      const expired = !card.valid_until || past(card.valid_until);
      return {
        ...base,
        until: card.valid_until ?? null,
        expired,
        actions: expired ? ["renew"] : ["check_in", "renew"],
      };
    }
  }
}
