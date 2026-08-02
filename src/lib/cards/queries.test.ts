import { describe, expect, it } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import { cardProgress, getCardByBarcode, getCardByToken } from "./queries";

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
