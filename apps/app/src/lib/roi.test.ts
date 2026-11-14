import { describe, expect, it, vi } from "vitest";
import { makeQueryBuilder } from "@/lib/test-utils/supabase-mock";
import { estimateRevenue, getRoi, periodBounds } from "./roi";

const biz = { id: "b1", timezone: "America/Mexico_City", average_ticket_cents: 15000 };

function client(rpcData: unknown, winBackConfig: unknown = null) {
  const from = vi.fn(() =>
    makeQueryBuilder({
      data: winBackConfig ? { config: winBackConfig } : null,
      error: null,
    }),
  );
  const rpc = vi.fn(async () => ({ data: rpcData, error: null }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { c: { from, rpc } as any, rpc };
}

describe("periodBounds", () => {
  it("is an inclusive window of `days` local dates ending today", () => {
    expect(periodBounds("UTC", 7, new Date("2026-11-14T12:00:00Z"))).toEqual({
      from: "2026-11-08",
      to: "2026-11-14",
    });
  });
  it("uses the business-local date, not UTC", () => {
    // 03:00Z is still the previous evening in Mexico City.
    expect(
      periodBounds("America/Mexico_City", 1, new Date("2026-11-14T03:00:00Z")),
    ).toEqual({ from: "2026-11-13", to: "2026-11-13" });
  });
});

describe("estimateRevenue", () => {
  it("is null without a ticket, else visits x ticket", () => {
    expect(estimateRevenue(3, null)).toBeNull();
    expect(estimateRevenue(3, undefined)).toBeNull();
    expect(estimateRevenue(3, 15000)).toBe(45000);
    expect(estimateRevenue(0, 15000)).toBe(0);
  });
});

describe("getRoi", () => {
  it("maps the RPC row and derives rate + revenue", async () => {
    const { c, rpc } = client(
      [
        {
          active_customers: 4,
          returning_customers: 3,
          returning_visits: 5,
          avg_days_between: 12.5,
          at_risk: 2,
          attributed_visits: 1,
        },
      ],
      { inactive_days: 45 },
    );
    const r = await getRoi(c, biz, 30, new Date("2026-11-14T12:00:00Z"));
    expect(r).toMatchObject({
      repeatRate: 0.75,
      avgDaysBetween: 12.5,
      atRisk: 2,
      atRiskFromDays: 45,
      attributedVisits: 1,
      estimatedRevenueCents: 75000,
    });
    expect(rpc).toHaveBeenCalledWith("roi_summary", {
      p_business_id: "b1",
      p_from: "2026-10-16",
      p_to: "2026-11-14",
      p_tz: "America/Mexico_City",
      p_at_risk_days: 45,
    });
  });

  it("handles an empty business: zero rate, default at-risk, no revenue without a ticket", async () => {
    const { c } = client([]);
    const r = await getRoi(c, { ...biz, average_ticket_cents: null }, 7);
    expect(r).toMatchObject({
      activeCustomers: 0,
      repeatRate: 0,
      avgDaysBetween: null,
      atRiskFromDays: 30,
      estimatedRevenueCents: null,
    });
  });
});
