import { afterEach, describe, expect, it, vi } from "vitest";

// `@/lib/env` caches its parsed environment in a module-level singleton the
// first time `serverEnv()` runs, so each test that needs a different env
// combination must reset the module registry and re-import fresh.
async function freshStripe() {
  vi.resetModules();
  return import("./stripe");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// `serverEnv()` requires these regardless of what we're testing.
function stubCoreEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
}

describe("priceIdForPlan / planForPriceId round trip", () => {
  it("resolves the monthly (default) and annual price id for each tier", async () => {
    stubCoreEnv();
    vi.stubEnv("STRIPE_PRICE_SMALL", "price_small_123");
    vi.stubEnv("STRIPE_PRICE_MEDIUM", "price_medium_123");
    vi.stubEnv("STRIPE_PRICE_BIG", "price_big_123");
    vi.stubEnv("STRIPE_PRICE_SMALL_ANNUAL", "price_small_yr");
    vi.stubEnv("STRIPE_PRICE_MEDIUM_ANNUAL", "price_medium_yr");
    vi.stubEnv("STRIPE_PRICE_BIG_ANNUAL", "price_big_yr");
    const { priceIdForPlan } = await freshStripe();

    expect(priceIdForPlan("small")).toBe("price_small_123");
    expect(priceIdForPlan("medium", "month")).toBe("price_medium_123");
    expect(priceIdForPlan("big")).toBe("price_big_123");
    expect(priceIdForPlan("small", "year")).toBe("price_small_yr");
    expect(priceIdForPlan("medium", "year")).toBe("price_medium_yr");
    expect(priceIdForPlan("big", "year")).toBe("price_big_yr");
  });

  it("maps both monthly and annual price ids back to the tier", async () => {
    stubCoreEnv();
    vi.stubEnv("STRIPE_PRICE_SMALL", "price_small_123");
    vi.stubEnv("STRIPE_PRICE_MEDIUM", "price_medium_123");
    vi.stubEnv("STRIPE_PRICE_BIG", "price_big_123");
    vi.stubEnv("STRIPE_PRICE_SMALL_ANNUAL", "price_small_yr");
    vi.stubEnv("STRIPE_PRICE_MEDIUM_ANNUAL", "price_medium_yr");
    vi.stubEnv("STRIPE_PRICE_BIG_ANNUAL", "price_big_yr");
    const { planForPriceId } = await freshStripe();

    expect(planForPriceId("price_small_123")).toBe("small");
    expect(planForPriceId("price_medium_123")).toBe("medium");
    expect(planForPriceId("price_big_123")).toBe("big");
    expect(planForPriceId("price_small_yr")).toBe("small");
    expect(planForPriceId("price_medium_yr")).toBe("medium");
    expect(planForPriceId("price_big_yr")).toBe("big");
  });

  it("returns null for an unrecognized price id", async () => {
    stubCoreEnv();
    vi.stubEnv("STRIPE_PRICE_SMALL", "price_small_123");
    const { planForPriceId } = await freshStripe();
    expect(planForPriceId("price_unknown")).toBeNull();
  });

  it("throws for trial, which has no Stripe price", async () => {
    stubCoreEnv();
    const { priceIdForPlan } = await freshStripe();
    expect(() => priceIdForPlan("trial")).toThrow(
      "Plan trial has no monthly Stripe price.",
    );
  });

  it("throws requireEnv's error when the plan's price env var isn't set", async () => {
    stubCoreEnv();
    vi.stubEnv("STRIPE_PRICE_SMALL", undefined);
    const { priceIdForPlan } = await freshStripe();
    expect(() => priceIdForPlan("small")).toThrow(/Missing STRIPE_PRICE_SMALL/);
  });
});
