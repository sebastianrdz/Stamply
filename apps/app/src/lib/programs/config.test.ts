import { describe, expect, it } from "vitest";
import { buildConfig, draftFromConfig, emptyDraft } from "./config";

describe("program config draft", () => {
  it("stamp is empty", () => {
    expect(buildConfig("stamp", emptyDraft)).toEqual({});
  });

  it("points: drops blank tiers, omits tiers when none", () => {
    const d = { ...emptyDraft, earn: "spend" as const, pointsPerUnit: "2" };
    expect(buildConfig("points", d)).toEqual({ earn: "spend", points_per_unit: 2, currency: "USD" });
    const withTiers = { ...d, pointTiers: [{ points: "100", reward: " Coffee " }, { points: "5", reward: "" }] };
    expect(buildConfig("points", withTiers).tiers).toEqual([{ points: 100, reward: "Coffee" }]);
  });

  it("coupon: unlimited uses -> null, min spend to cents, item value 0", () => {
    const d = { ...emptyDraft, maxUses: "", validDays: "30", minSpend: "12.5" };
    expect(buildConfig("coupon", d)).toEqual({
      discount_kind: "percent", value: 10, max_uses: null, valid_days: 30, min_spend_cents: 1250,
    });
    expect(buildConfig("coupon", { ...emptyDraft, discountKind: "item" }).value).toBe(0);
  });

  it("membership: tiers and renew_days", () => {
    const d = { ...emptyDraft, memberTiers: [{ name: "Gold", benefits: "Towel" }] };
    expect(buildConfig("membership", d)).toEqual({
      access: "free", renew_days: 30, tiers: [{ name: "Gold", benefits: "Towel" }],
    });
  });

  it("round-trips a saved coupon config", () => {
    const cfg = { discount_kind: "fixed", value: 5, max_uses: null, valid_days: 7, min_spend_cents: 2000 };
    expect(buildConfig("coupon", draftFromConfig(cfg))).toEqual(cfg);
  });
});
