import { describe, expect, it } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import {
  availableRewardsForCustomer,
  cardProgress,
  getCardByBarcode,
  getCardByToken,
} from "./queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

describe("cardProgress", () => {
  it("returns points for a points-type program", () => {
    expect(cardProgress({ stamps: 3, points: 90 }, { type: "points" })).toBe(
      90,
    );
  });

  it("returns stamps for a stamp-type program", () => {
    expect(cardProgress({ stamps: 3, points: 90 }, { type: "stamp" })).toBe(3);
  });
});

describe("getCardByToken", () => {
  it("queries by the pass_auth_token column", async () => {
    const mock = makeSupabaseMock({ cards: { data: { id: "card-1" } } });
    const card = await getCardByToken(mock as AnyClient, "auth-tok");
    expect(card).toEqual({ id: "card-1" });
    expect(mock.from).toHaveBeenCalledWith("cards");
    expect(mock.builderFor("cards").eq).toHaveBeenCalledWith(
      "pass_auth_token",
      "auth-tok",
    );
    expect(mock.builderFor("cards").maybeSingle).toHaveBeenCalled();
  });

  it("returns null when no row matches", async () => {
    const mock = makeSupabaseMock({ cards: { data: null } });
    const card = await getCardByToken(mock as AnyClient, "missing-tok");
    expect(card).toBeNull();
  });
});

describe("getCardByBarcode", () => {
  it("queries by the barcode_value column", async () => {
    const mock = makeSupabaseMock({ cards: { data: { id: "card-2" } } });
    const card = await getCardByBarcode(mock as AnyClient, "stmp_xyz");
    expect(card).toEqual({ id: "card-2" });
    expect(mock.builderFor("cards").eq).toHaveBeenCalledWith(
      "barcode_value",
      "stmp_xyz",
    );
  });

  it("returns null when no row matches", async () => {
    const mock = makeSupabaseMock({ cards: { data: null } });
    const card = await getCardByBarcode(mock as AnyClient, "stmp_missing");
    expect(card).toBeNull();
  });
});

describe("availableRewardsForCustomer", () => {
  it("counts the customer's completed cards at the business", async () => {
    const mock = makeSupabaseMock({ cards: { count: 3 } });
    const n = await availableRewardsForCustomer(
      mock as AnyClient,
      "biz-1",
      "cust-1",
    );
    expect(n).toBe(3);
    expect(mock.from).toHaveBeenCalledWith("cards");
    const builder = mock.builderFor("cards");
    expect(builder.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(builder.eq).toHaveBeenCalledWith("business_id", "biz-1");
    expect(builder.eq).toHaveBeenCalledWith("customer_id", "cust-1");
    expect(builder.eq).toHaveBeenCalledWith("status", "completed");
  });

  it("returns 0 when the count is null", async () => {
    const mock = makeSupabaseMock({ cards: { count: null } });
    const n = await availableRewardsForCustomer(
      mock as AnyClient,
      "biz-1",
      "cust-2",
    );
    expect(n).toBe(0);
  });
});
