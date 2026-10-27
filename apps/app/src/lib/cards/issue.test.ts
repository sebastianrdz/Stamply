import { describe, expect, it } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import { issueCard } from "./issue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const params = {
  businessId: "biz-1",
  programId: "prog-1",
  customerId: "cust-1",
};

describe("issueCard", () => {
  it("inserts a card with generated barcode/auth-token/apple-serial and returns it", async () => {
    const mock = makeSupabaseMock({
      cards: { data: { id: "card-1", ...params }, error: null },
    });

    const card = await issueCard(mock as AnyClient, params);

    expect(card).toEqual({ id: "card-1", ...params });
    expect(mock.from).toHaveBeenCalledWith("cards");
    const insertArg = mock.builderFor("cards").insert.mock.calls[0][0];
    expect(insertArg.business_id).toBe("biz-1");
    expect(insertArg.program_id).toBe("prog-1");
    expect(insertArg.customer_id).toBe("cust-1");
    expect(insertArg.barcode_value).toMatch(/^stmp_/);
    expect(typeof insertArg.pass_auth_token).toBe("string");
    expect(insertArg.pass_auth_token.length).toBeGreaterThan(0);
    expect(typeof insertArg.apple_serial).toBe("string");
    expect(insertArg.apple_serial.length).toBeGreaterThan(0);
  });

  it("throws the Supabase error message when the insert fails", async () => {
    const mock = makeSupabaseMock({
      cards: { data: null, error: { message: "insert failed" } },
    });
    await expect(issueCard(mock as AnyClient, params)).rejects.toThrow(
      "insert failed",
    );
  });

  it("throws a fallback message when there's no error but also no data", async () => {
    const mock = makeSupabaseMock({ cards: { data: null, error: null } });
    await expect(issueCard(mock as AnyClient, params)).rejects.toThrow(
      "Failed to issue card",
    );
  });

  it("coupon: sets expires_at from config.valid_days", async () => {
    const mock = makeSupabaseMock({
      programs: { data: { type: "coupon", config: { valid_days: 30 } } },
      cards: { data: { id: "card-1" }, error: null },
    });
    await issueCard(mock as AnyClient, params);
    const arg = mock.builderFor("cards").insert.mock.calls[0][0];
    const days = (new Date(arg.expires_at).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("coupon: no expiry when valid_days is null", async () => {
    const mock = makeSupabaseMock({
      programs: { data: { type: "coupon", config: { valid_days: null } } },
      cards: { data: { id: "card-1" }, error: null },
    });
    await issueCard(mock as AnyClient, params);
    expect(mock.builderFor("cards").insert.mock.calls[0][0]).not.toHaveProperty(
      "expires_at",
    );
  });

  it("membership free: first tier name and valid_until = now + renew_days", async () => {
    const mock = makeSupabaseMock({
      programs: {
        data: {
          type: "membership",
          config: {
            access: "free",
            renew_days: 30,
            tiers: [{ name: "Gold", benefits: "x" }, { name: "Silver", benefits: "y" }],
          },
        },
      },
      cards: { data: { id: "card-1" }, error: null },
    });
    await issueCard(mock as AnyClient, params);
    const arg = mock.builderFor("cards").insert.mock.calls[0][0];
    expect(arg.tier).toBe("Gold");
    expect(new Date(arg.valid_until).getTime()).toBeGreaterThan(Date.now() + 29 * 86400000);
  });

  it("membership staff_activated: valid_until stays null (pending)", async () => {
    const mock = makeSupabaseMock({
      programs: {
        data: { type: "membership", config: { access: "staff_activated", renew_days: 30, tiers: [] } },
      },
      cards: { data: { id: "card-1" }, error: null },
    });
    await issueCard(mock as AnyClient, params);
    const arg = mock.builderFor("cards").insert.mock.calls[0][0];
    expect(arg.tier).toBeNull();
    expect(arg.valid_until).toBeNull();
  });
});
