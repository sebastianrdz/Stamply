import { describe, expect, it } from "vitest";
import esDict from "@stamply/i18n/dictionaries/es.json";
import type { Program } from "@/types/database";
import { programRules, programStats } from "./summary";

const d = esDict.dashboard.programs.list.details;
const prog = (o: Partial<Program>) =>
  ({ id: "p1", goal: 10, reward_description: "Premio", config: {}, ...o }) as Program;
const values = (rows: { label: string; value: string }[]) => Object.fromEntries(rows.map((r) => [r.label, r.value]));

describe("programRules", () => {
  it("stamp: goal and reward", () => {
    expect(values(programRules(prog({ type: "stamp" }), d))).toEqual({ Meta: "10 sellos", Recompensa: "Premio" });
  });

  it("points: spend rate and tiers, or legacy single goal", () => {
    const tiered = values(
      programRules(prog({ type: "points", config: { earn: "spend", points_per_unit: 2, tiers: [{ points: 100, reward: "Café" }] } }), d),
    );
    expect(tiered["Cómo se ganan"]).toBe("2 por cada $1 gastado");
    expect(tiered.Premios).toBe("100 pts → Café");
    const legacy = values(programRules(prog({ type: "points", goal: 50 }), d));
    expect(legacy["Cómo se ganan"]).toBe("1 por visita");
    expect(legacy.Recompensa).toBe("50 puntos → Premio");
  });

  it("coupon: discount, uses, validity, min spend", () => {
    const v = values(
      programRules(
        prog({ type: "coupon", config: { discount_kind: "fixed", value: 50, max_uses: 3, valid_days: 30, min_spend_cents: 20000 } }),
        d,
      ),
    );
    expect(v).toMatchObject({ Descuento: "$50", "Usos por cliente": "3", Vigencia: "30 días desde la inscripción", "Compra mínima": "$200" });
    const open = values(programRules(prog({ type: "coupon", config: { discount_kind: "item", max_uses: null, valid_days: null } }), d));
    expect(open).toMatchObject({ Descuento: "Artículo gratis", "Usos por cliente": "Ilimitados", Vigencia: "Sin vencimiento" });
    expect(open["Compra mínima"]).toBeUndefined();
  });

  it("membership: activation, renewal, tiers", () => {
    const v = values(
      programRules(prog({ type: "membership", config: { access: "staff_activated", renew_days: 30, tiers: [{ name: "Bronce" }, { name: "Oro" }] } }), d),
    );
    expect(v).toMatchObject({ Activación: "La activa el personal", Renovación: "Cada 30 días", Niveles: "Bronce · Oro", Beneficios: "Premio" });
  });
});

describe("programStats", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const base = { rewards: 0, points: 0, points_redeemed: 0, uses_count: 0, valid_until: null };
  const cards = [
    { ...base, program_id: "p1", rewards: 2, points: 150, points_redeemed: 100, uses_count: 3, valid_until: "2026-07-01T00:00:00Z" },
    { ...base, program_id: "p1", rewards: 1, uses_count: 1, valid_until: "2026-05-01T00:00:00Z" },
    { ...base, program_id: "other", rewards: 9 },
  ];
  it("counts only this program's cards, with a type-specific metric", () => {
    expect(programStats({ id: "p1", type: "stamp" }, cards, d, now)).toEqual([
      { label: d.statCards, value: "2" },
      { label: d.statPendingRewards, value: "3" },
    ]);
    expect(programStats({ id: "p1", type: "points" }, cards, d, now)[1].value).toBe("50");
    expect(programStats({ id: "p1", type: "coupon" }, cards, d, now)[1].value).toBe("4");
    expect(programStats({ id: "p1", type: "membership" }, cards, d, now)[1].value).toBe("1");
  });
});
