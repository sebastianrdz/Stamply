import { describe, expect, it } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import { assertWithinLimit, currentCount, LimitExceededError } from "./entitlements";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

describe("currentCount", () => {
  it("queries the memberships table for employees and returns the count", async () => {
    const mock = makeSupabaseMock({ memberships: { count: 4 } });
    const count = await currentCount(mock as AnyClient, "biz1", "employees");
    expect(count).toBe(4);
    expect(mock.from).toHaveBeenCalledWith("memberships");
    expect(mock.builderFor("memberships").eq).toHaveBeenCalledWith(
      "business_id",
      "biz1",
    );
  });

  it("queries the locations table for locations", async () => {
    const mock = makeSupabaseMock({ locations: { count: 2 } });
    const count = await currentCount(mock as AnyClient, "biz1", "locations");
    expect(count).toBe(2);
    expect(mock.from).toHaveBeenCalledWith("locations");
  });

  it("queries the customers table for customers", async () => {
    const mock = makeSupabaseMock({ customers: { count: 42 } });
    const count = await currentCount(mock as AnyClient, "biz1", "customers");
    expect(count).toBe(42);
    expect(mock.from).toHaveBeenCalledWith("customers");
  });

  it("queries the programs table for programs", async () => {
    const mock = makeSupabaseMock({ programs: { count: 7 } });
    const count = await currentCount(mock as AnyClient, "biz1", "programs");
    expect(count).toBe(7);
    expect(mock.from).toHaveBeenCalledWith("programs");
  });

  it("falls back to 0 when count is null", async () => {
    const mock = makeSupabaseMock({ customers: { count: null } });
    const count = await currentCount(mock as AnyClient, "biz1", "customers");
    expect(count).toBe(0);
  });
});

describe("assertWithinLimit", () => {
  it("throws LimitExceededError with resource/plan/limit when over the limit", async () => {
    const mock = makeSupabaseMock({ customers: { count: 100 } });
    const business = { id: "biz1", plan: "small" as const };

    await expect(
      assertWithinLimit(mock as AnyClient, business, "customers"),
    ).rejects.toThrow(LimitExceededError);

    try {
      await assertWithinLimit(mock as AnyClient, business, "customers");
    } catch (e) {
      expect(e).toBeInstanceOf(LimitExceededError);
      const err = e as LimitExceededError;
      expect(err.resource).toBe("customers");
      expect(err.plan).toBe("small");
      expect(err.limit).toBe(100);
      expect(err.message).toBe(
        "Your plan allows 100 customers. Upgrade to add more.",
      );
    }
  });

  it("resolves without error when within the limit", async () => {
    const mock = makeSupabaseMock({ customers: { count: 50 } });
    const business = { id: "biz1", plan: "small" as const };
    await expect(
      assertWithinLimit(mock as AnyClient, business, "customers"),
    ).resolves.toBeUndefined();
  });

  it("resolves without querying currentCount at all when the plan is unlimited", async () => {
    const mock = makeSupabaseMock({});
    const business = { id: "biz1", plan: "big" as const };
    await expect(
      assertWithinLimit(mock as AnyClient, business, "locations"),
    ).resolves.toBeUndefined();
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("respects a custom `additional` count", async () => {
    const mock = makeSupabaseMock({ memberships: { count: 4 } });
    const business = { id: "biz1", plan: "medium" as const }; // limit 5
    // 4 + 1 = 5 -> ok
    await expect(
      assertWithinLimit(mock as AnyClient, business, "employees", 1),
    ).resolves.toBeUndefined();
  });

  it("throws when additional pushes past the limit", async () => {
    const mock = makeSupabaseMock({ memberships: { count: 4 } });
    const business = { id: "biz1", plan: "medium" as const }; // limit 5
    // 4 + 2 = 6 -> exceeds
    await expect(
      assertWithinLimit(mock as AnyClient, business, "employees", 2),
    ).rejects.toThrow(LimitExceededError);
  });
});
