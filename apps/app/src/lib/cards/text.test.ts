import { describe, expect, it } from "vitest";
import esDict from "@stamply/i18n/dictionaries/es.json";
import { cardState } from "./state";
import { cardText } from "./text";

const w = esDict.wallet;
const opts = { locale: "es-MX", business: "Gym", rewards: 0, timeZone: "UTC" };
const card = { stamps: 0, points: 0, rewards: 0 };

describe("cardText", () => {
  it("stamp keeps the progress/goal header and rewards field", () => {
    const p = { type: "stamp" as const, goal: 10, reward_description: "Free" };
    const t = cardText(cardState({ ...card, stamps: 4 }, p), p, w, { ...opts, rewards: 2 });
    expect(t.legacy).toBe(true);
    expect(t.header).toEqual({ label: "SELLOS", value: "4/10" });
    expect(t.primary).toBeNull();
    expect(t.secondary[0].value).toBe("2");
  });

  it("points with tiers: balance header and points-to-next-tier", () => {
    const p = {
      type: "points" as const, goal: 1, reward_description: "x",
      config: { tiers: [{ points: 100, reward: "Café" }] },
    };
    const t = cardText(cardState({ ...card, points: 60 }, p), p, w, opts);
    expect(t.header.value).toBe("60");
    expect(t.primary?.value).toBe("40 pts para Café");
  });

  it("coupon: discount, uses left, valid-until", () => {
    const p = {
      type: "coupon" as const, goal: 1, reward_description: "Corte",
      config: { discount_kind: "percent", value: 20, max_uses: 5 },
    };
    const c = { ...card, uses_count: 3, expires_at: "2099-11-30T12:00:00Z" };
    const t = cardText(cardState(c, p), p, w, opts);
    expect(t.header.value).toBe("20% DESC.");
    expect(t.secondary[0].value).toBe("2");
    expect(t.auxiliary[0].value).toContain("2099");
  });

  it("membership: pending until activated, benefits from the tier", () => {
    const p = {
      type: "membership" as const, goal: 1, reward_description: "Club",
      config: { tiers: [{ name: "Gold", benefits: "Toalla" }] },
    };
    const pending = cardText(cardState({ ...card, tier: "Gold" }, p), p, w, opts);
    expect(pending.secondary[0].value).toBe(w.pending);
    const active = cardText(cardState({ ...card, tier: "Gold", valid_until: "2099-01-01T00:00:00Z" }, p), p, w, opts);
    expect(active.benefits).toBe("Toalla");
    expect(active.header.value).toBe("Gold");
  });

  it("non-stamp cards never mention stamps, in any field", () => {
    const programs = [
      { type: "points" as const, goal: 100, reward_description: "Café" },
      { type: "points" as const, goal: 1, reward_description: "x", config: { tiers: [{ points: 100, reward: "Café" }] } },
      { type: "coupon" as const, goal: 1, reward_description: "2x1", config: { discount_kind: "percent", value: 20, max_uses: 2 } },
      { type: "membership" as const, goal: 1, reward_description: "Pase mensual", config: { tiers: [{ name: "Oro", benefits: "Todo" }] } },
      { type: "membership" as const, goal: 1, reward_description: "Pase mensual" },
    ];
    for (const p of programs) {
      const t = cardText(cardState({ ...card, points: 20, valid_until: "2999-01-01T00:00:00Z", tier: "Oro" }, p), p, w, opts);
      expect(JSON.stringify(t).toLowerCase()).not.toMatch(/sell|stamp/);
    }
  });

  it("tiered points explain redeeming for rewards, not reaching a goal", () => {
    const p = { type: "points" as const, goal: 100, reward_description: "x", config: { tiers: [{ points: 50, reward: "A" }] } };
    const t = cardText(cardState(card, p), p, w, opts);
    expect(t.howTo).toBe(interpolateHow());
    expect(t.howTo).not.toMatch(/Llega a/);
  });

  it("tierless membership does not show the benefits blurb as a tier", () => {
    const p = { type: "membership" as const, goal: 1, reward_description: "Pase mensual" };
    const t = cardText(cardState(card, p), p, w, opts);
    expect(t.header).toEqual({ label: "MEMBRESÍA", value: "Miembro" });
  });
});

function interpolateHow() {
  return w.howToPoints.replace("{business}", "Gym");
}
