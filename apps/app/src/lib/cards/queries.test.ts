import { describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import {
  cardProgress,
  getCardByBarcode,
  getCardByToken,
} from "./queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

describe("cardProgress", () => {
  it("returns points progress toward the next reward for a points program", () => {
    expect(
      cardProgress({ stamps: 3, points: 90 }, { type: "points", goal: 100 }),
    ).toBe(90);
  });

  it("returns stamps progress toward the next reward for a stamp program", () => {
    expect(
      cardProgress({ stamps: 3, points: 90 }, { type: "stamp", goal: 10 }),
    ).toBe(3);
  });

  it("wraps to the remainder once the lifetime total passes the goal", () => {
    // 24 lifetime stamps, goal 10 -> 2 rewards banked, 4 toward the next.
    expect(
      cardProgress({ stamps: 24, points: 0 }, { type: "stamp", goal: 10 }),
    ).toBe(4);
  });

  it("shows 0 at an exact goal boundary (reward just earned)", () => {
    expect(
      cardProgress({ stamps: 20, points: 0 }, { type: "stamp", goal: 10 }),
    ).toBe(0);
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

  it("returns null when no row matches (genuine not-found: no data, no error)", async () => {
    const mock = makeSupabaseMock({ cards: { data: null, error: null } });
    const card = await getCardByToken(mock as AnyClient, "missing-tok");
    expect(card).toBeNull();
  });

  it("throws (and logs) instead of returning null on a real Supabase error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mock = makeSupabaseMock({
      cards: { data: null, error: { message: "connection reset" } },
    });
    await expect(getCardByToken(mock as AnyClient, "auth-tok")).rejects.toEqual(
      { message: "connection reset" },
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
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
