import { describe, expect, it } from "vitest";
import esDict from "@stamply/i18n/dictionaries/es.json";
import { programTagline } from "./tagline";

const t = esDict.programTagline;

describe("programTagline", () => {
  it("never mentions stamps for non-stamp types", () => {
    expect(programTagline({ type: "stamp", goal: 8 }, t)).toBe("Junta 8 sellos");
    expect(programTagline({ type: "points", goal: 100 }, t)).toBe("Junta 100 puntos");
    expect(programTagline({ type: "points", goal: 100, config: { tiers: [{}] } }, t)).toBe(t.pointsTiers);
    expect(programTagline({ type: "coupon", goal: 1, config: { discount_kind: "percent", value: 20 } }, t)).toBe("20% de descuento");
    expect(programTagline({ type: "coupon", goal: 1, config: { discount_kind: "fixed", value: 50 } }, t)).toBe("$50 de descuento");
    expect(programTagline({ type: "coupon", goal: 1, config: { discount_kind: "item" } }, t)).toBe("Artículo gratis");
    expect(programTagline({ type: "membership", goal: 1 }, t)).toBe(t.membership);
  });
});
