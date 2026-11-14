import { describe, expect, it } from "vitest";
import {
  PLANS,
  isWithinLimit,
  planLimit,
  annualMonthly,
  annualSavingsPct,
} from "@stamply/plans";

describe("PLANS", () => {
  it("prices match the published tiers", () => {
    expect(PLANS.none.price).toBe(0);
    expect(PLANS.small.price).toBe(679);
    expect(PLANS.medium.price).toBe(1879);
    expect(PLANS.big.price).toBe(3579);
  });

  it("small plan limits", () => {
    expect(PLANS.small.limits).toEqual({
      locations: 1,
      employees: 3,
      customers: 5000,
      programs: 1,
    });
  });

  it("medium plan limits", () => {
    expect(PLANS.medium.limits).toEqual({
      locations: 3,
      employees: 10,
      customers: 20000,
      programs: 3,
    });
  });

  it("big plan limits", () => {
    expect(PLANS.big.limits).toEqual({
      locations: 5,
      employees: 20,
      customers: 50000,
      programs: 5,
    });
  });

  it("none has no stripePriceEnv", () => {
    expect(PLANS.none.stripePriceEnv).toBeUndefined();
  });

  it("annual totals are 2 months free (10x monthly)", () => {
    expect(PLANS.small.annualTotal).toBe(6790);
    expect(PLANS.medium.annualTotal).toBe(18790);
    expect(PLANS.big.annualTotal).toBe(35790);
  });
});

describe("annual pricing helpers", () => {
  it("annualMonthly is the rounded per-month equivalent", () => {
    expect(annualMonthly("small")).toBe(566); // 6790/12 = 565.83
    expect(annualMonthly("medium")).toBe(1566); // 18790/12 = 1565.83
    expect(annualMonthly("big")).toBe(2983); // 35790/12 = 2982.5
  });

  it("annualMonthly is null for a plan with no annual option", () => {
    expect(annualMonthly("none")).toBeNull();
  });

  it("annualSavingsPct is ~17% (2 months free) for every paid tier", () => {
    expect(annualSavingsPct("small")).toBe(17);
    expect(annualSavingsPct("medium")).toBe(17);
    expect(annualSavingsPct("big")).toBe(17);
  });

  it("annualSavingsPct is 0 for a plan with no annual option", () => {
    expect(annualSavingsPct("none")).toBe(0);
  });
});

describe("isWithinLimit", () => {
  it("is true exactly at the limit boundary (count + additional === limit)", () => {
    // small.locations limit is 1; count=0 + additional=1 === 1 -> allowed
    expect(isWithinLimit("small", "locations", 0, 1)).toBe(true);
  });

  it("is false one past the limit boundary (count + additional === limit + 1)", () => {
    expect(isWithinLimit("small", "locations", 1, 1)).toBe(false);
  });

  it("medium.customers boundary: 19999 + 1 === 20000 -> allowed", () => {
    expect(isWithinLimit("medium", "customers", 19999, 1)).toBe(true);
  });

  it("medium.customers boundary: 20000 + 1 === 20001 -> rejected", () => {
    expect(isWithinLimit("medium", "customers", 20000, 1)).toBe(false);
  });

  it("null limit (unlimited) is always true regardless of count", () => {
    // No shipped plan is unlimited today; keep the code path covered.
    const { locations, employees } = PLANS.big.limits;
    PLANS.big.limits.locations = null;
    PLANS.big.limits.employees = null;
    try {
      expect(isWithinLimit("big", "locations", 0, 1)).toBe(true);
      expect(isWithinLimit("big", "locations", 1_000_000, 1)).toBe(true);
      expect(
        isWithinLimit("big", "employees", Number.MAX_SAFE_INTEGER, 5),
      ).toBe(true);
    } finally {
      PLANS.big.limits.locations = locations;
      PLANS.big.limits.employees = employees;
    }
  });

  it("defaults additional to 1 when omitted", () => {
    // small.employees limit is 3; count=2 with default additional=1 -> allowed
    expect(isWithinLimit("small", "employees", 2)).toBe(true);
    // count=3 with default additional=1 -> 4 > 3 -> rejected
    expect(isWithinLimit("small", "employees", 3)).toBe(false);
  });

  it("supports additional > 1 (bulk add)", () => {
    // big.customers limit 50000; 49990 + 11 = 50001 -> rejected
    expect(isWithinLimit("big", "customers", 49990, 11)).toBe(false);
    expect(isWithinLimit("big", "customers", 49990, 10)).toBe(true);
  });
});

describe("planLimit", () => {
  it("returns the numeric limit for a capped resource", () => {
    expect(planLimit("medium", "programs")).toBe(3);
  });

  it("returns null for an unlimited resource", () => {
    const original = PLANS.big.limits.programs;
    PLANS.big.limits.programs = null; // no shipped plan is unlimited today
    try {
      expect(planLimit("big", "programs")).toBeNull();
    } finally {
      PLANS.big.limits.programs = original;
    }
  });

  it("returns zero limits for no plan", () => {
    expect(planLimit("none", "customers")).toBe(0);
  });
});
