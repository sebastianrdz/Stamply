import { describe, expect, it } from "vitest";
import { referralSettings, supportsReferrals } from "./config";
import { referralSchema } from "./schema";

const on = {
  referral: {
    enabled: true,
    referrer_bonus: 2,
    referred_bonus: 1,
    monthly_cap: 3,
  },
};

describe("referralSettings", () => {
  it("reads enabled settings for stamp and points programs", () => {
    expect(referralSettings("stamp", on)).toEqual({
      referrerBonus: 2,
      referredBonus: 1,
      monthlyCap: 3,
    });
    expect(referralSettings("points", on)?.monthlyCap).toBe(3);
  });

  it("is null when off, absent or unsupported", () => {
    expect(referralSettings("stamp", {})).toBeNull();
    expect(referralSettings("stamp", null)).toBeNull();
    expect(
      referralSettings("stamp", { referral: { enabled: false } }),
    ).toBeNull();
    expect(referralSettings("coupon", on)).toBeNull();
    expect(referralSettings("membership", on)).toBeNull();
  });

  it("falls back to per-type defaults for bad values", () => {
    const bad = {
      referral: {
        enabled: true,
        referrer_bonus: 9999,
        referred_bonus: -1,
        monthly_cap: 0,
      },
    };
    expect(referralSettings("stamp", bad)).toEqual({
      referrerBonus: 1,
      referredBonus: 1,
      monthlyCap: 5,
    });
    expect(referralSettings("points", bad)).toEqual({
      referrerBonus: 10,
      referredBonus: 10,
      monthlyCap: 5,
    });
  });

  it("only stamp and points support referrals", () => {
    expect(
      ["stamp", "points", "coupon", "membership"].map(supportsReferrals),
    ).toEqual([true, true, false, false]);
  });
});

describe("referralSchema", () => {
  const ok = {
    enabled: true,
    referrer_bonus: 1,
    referred_bonus: 0,
    monthly_cap: 5,
  };
  it("accepts in-range settings, including a zero friend bonus", () => {
    expect(referralSchema(5).safeParse(ok).success).toBe(true);
  });
  it.each([
    [{ ...ok, referrer_bonus: 0 }],
    [{ ...ok, referrer_bonus: 6 }],
    [{ ...ok, referred_bonus: -1 }],
    [{ ...ok, monthly_cap: 21 }],
    [{ ...ok, monthly_cap: 1.5 }],
    [{ ...ok, enabled: false }],
  ])("rejects %j", (v) =>
    expect(referralSchema(5).safeParse(v).success).toBe(false),
  );
  it("allows bigger bonuses for points", () => {
    expect(
      referralSchema(500).safeParse({ ...ok, referrer_bonus: 500 }).success,
    ).toBe(true);
  });
});
