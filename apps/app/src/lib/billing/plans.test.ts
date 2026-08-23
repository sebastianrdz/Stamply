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
    expect(PLANS.trial.price).toBe(0);
    expect(PLANS.small.price).toBe(679);
    expect(PLANS.medium.price).toBe(1279);
    expect(PLANS.big.price).toBe(1879);
  });

  it("small plan limits", () => {
    expect(PLANS.small.limits).toEqual({
      locations: 1,
      employees: 1,
      customers: 100,
      programs: 1,
    });
  });

  it("medium plan limits", () => {
    expect(PLANS.medium.limits).toEqual({
      locations: 3,
      employees: 5,
      customers: 1000,
      programs: 3,
    });
  });

  it("big plan limits: unlimited locations/employees/programs, capped customers", () => {
    expect(PLANS.big.limits).toEqual({
      locations: null,
      employees: null,
      customers: 10000,
      programs: null,
    });
  });

  it("trial has no stripePriceEnv", () => {
    expect(PLANS.trial.stripePriceEnv).toBeUndefined();
  });

  it("annual totals are 2 months free (10x monthly)", () => {
    expect(PLANS.small.annualTotal).toBe(6790);
    expect(PLANS.medium.annualTotal).toBe(12790);
    expect(PLANS.big.annualTotal).toBe(18790);
  });
});

describe("annual pricing helpers", () => {
  it("annualMonthly is the rounded per-month equivalent", () => {
    expect(annualMonthly("small")).toBe(566); // 6790/12 = 565.83
    expect(annualMonthly("medium")).toBe(1066); // 12790/12 = 1065.83
    expect(annualMonthly("big")).toBe(1566); // 18790/12 = 1565.83
  });

  it("annualMonthly is null for a plan with no annual option", () => {
    expect(annualMonthly("trial")).toBeNull();
  });

  it("annualSavingsPct is ~17% (2 months free) for every paid tier", () => {
    expect(annualSavingsPct("small")).toBe(17);
    expect(annualSavingsPct("medium")).toBe(17);
    expect(annualSavingsPct("big")).toBe(17);
  });

  it("annualSavingsPct is 0 for a plan with no annual option", () => {
    expect(annualSavingsPct("trial")).toBe(0);
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

  it("medium.customers boundary: 999 + 1 === 1000 -> allowed", () => {
    expect(isWithinLimit("medium", "customers", 999, 1)).toBe(true);
  });

  it("medium.customers boundary: 1000 + 1 === 1001 -> rejected", () => {
    expect(isWithinLimit("medium", "customers", 1000, 1)).toBe(false);
  });

  it("null limit (unlimited) is always true regardless of count", () => {
    expect(isWithinLimit("big", "locations", 0, 1)).toBe(true);
    expect(isWithinLimit("big", "locations", 1_000_000, 1)).toBe(true);
    expect(isWithinLimit("big", "employees", Number.MAX_SAFE_INTEGER, 5)).toBe(
      true,
    );
  });

  it("defaults additional to 1 when omitted", () => {
    // small.employees limit is 1; count=0 with default additional=1 -> allowed
    expect(isWithinLimit("small", "employees", 0)).toBe(true);
    // count=1 with default additional=1 -> 2 > 1 -> rejected
    expect(isWithinLimit("small", "employees", 1)).toBe(false);
  });

  it("supports additional > 1 (bulk add)", () => {
    // big.customers limit 10000; 9990 + 11 = 10001 -> rejected
    expect(isWithinLimit("big", "customers", 9990, 11)).toBe(false);
    expect(isWithinLimit("big", "customers", 9990, 10)).toBe(true);
  });
});

describe("planLimit", () => {
  it("returns the numeric limit for a capped resource", () => {
    expect(planLimit("medium", "programs")).toBe(3);
  });

  it("returns null for an unlimited resource", () => {
    expect(planLimit("big", "programs")).toBeNull();
  });

  it("returns the trial limits", () => {
    expect(planLimit("trial", "customers")).toBe(50);
  });
});
