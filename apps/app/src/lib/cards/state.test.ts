import { describe, expect, it } from "vitest";
import { cardState } from "./state";

const card = { stamps: 0, points: 0, rewards: 0 };
const now = new Date("2026-06-01T00:00:00Z");

describe("cardState", () => {
  it("stamp: wraps progress and offers redeem when a reward is banked", () => {
    const s = cardState({ ...card, stamps: 24, rewards: 2 }, { type: "stamp", goal: 10 });
    expect(s.progress).toBe(4);
    expect(s.actions).toEqual(["stamp", "redeem"]);
  });

  it("points without tiers keeps the legacy single-goal behaviour", () => {
    const s = cardState({ ...card, points: 250, rewards: 2, points_redeemed: 100 }, { type: "points", goal: 100 });
    expect(s.progress).toBe(50);
    expect(s.available).toBe(150);
    expect(s.actions).toEqual(["stamp", "redeem"]);
  });

  it("points with tiers: spend earning, affordable tier, next tier", () => {
    const config = { earn: "spend", tiers: [{ points: 500, reward: "B" }, { points: 100, reward: "A" }] };
    const s = cardState({ ...card, points: 250, points_redeemed: 50 }, { type: "points", goal: 1, config });
    expect(s.available).toBe(200);
    expect(s.nextTier).toEqual({ points: 500, reward: "B" });
    expect(s.actions).toEqual(["spend", "redeem_tier"]);
  });

  it("coupon: counts down uses, unlimited when max_uses absent, blocks when expired", () => {
    const p = { type: "coupon" as const, goal: 1, config: { max_uses: 2 } };
    expect(cardState({ ...card, uses_count: 1 }, p, now).usesLeft).toBe(1);
    expect(cardState({ ...card, uses_count: 2 }, p, now).actions).toEqual([]);
    expect(cardState(card, { type: "coupon", goal: 1 }, now)).toMatchObject({ usesLeft: null, actions: ["use_coupon"] });
    const expired = cardState({ ...card, expires_at: "2026-05-01T00:00:00Z" }, p, now);
    expect(expired).toMatchObject({ expired: true, actions: [] });
  });

  it("membership with tiers offers set_tier even when pending or lapsed", () => {
    const p = { type: "membership" as const, goal: 1, config: { tiers: [{ name: "Gold" }] } };
    expect(cardState(card, p, now).actions).toEqual(["renew", "set_tier"]);
    expect(cardState({ ...card, valid_until: "2026-07-01T00:00:00Z" }, p, now).actions).toEqual([
      "check_in",
      "renew",
      "set_tier",
    ]);
  });

  it("membership: pending and lapsed only allow renew", () => {
    const p = { type: "membership" as const, goal: 1 };
    expect(cardState(card, p, now).actions).toEqual(["renew"]);
    expect(cardState({ ...card, valid_until: "2026-05-01T00:00:00Z" }, p, now).expired).toBe(true);
    expect(cardState({ ...card, valid_until: "2026-07-01T00:00:00Z" }, p, now).actions).toEqual(["check_in", "renew"]);
  });
});
