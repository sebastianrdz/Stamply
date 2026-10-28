import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/wallet/notify", () => ({ notifyCardUpdatedForBirthday: vi.fn() }));
vi.mock("@/lib/rewards/queries", () => ({ grantStandaloneReward: vi.fn() }));

import { fetchAll } from "./cron";
import { errInfo } from "./log";
import { localDate, tzOrUtc } from "./dates";

describe("fetchAll", () => {
  it("walks every page, not just the first", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const ranges: [number, number][] = [];
    const out = await fetchAll<number>(async (f, t) => {
      ranges.push([f, t]);
      return { data: rows.slice(f, t + 1), error: null };
    }, 1000);
    expect(out).toHaveLength(2500);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("stops after an exact-size last page's empty follow-up and surfaces errors", async () => {
    const out = await fetchAll<number>(
      async (f) => ({ data: f === 0 ? [1, 2] : [], error: null }),
      2,
    );
    expect(out).toEqual([1, 2]);
    await expect(
      fetchAll(async () => ({ data: null, error: { code: "X" } })),
    ).rejects.toEqual({ code: "X" });
  });
});

describe("timezone guard and error info", () => {
  it("falls back to UTC for a bad business timezone", () => {
    expect(tzOrUtc("Not/AZone")).toBe("UTC");
    expect(localDate("Not/AZone", new Date("2026-01-02T03:00:00Z"))).toBe("2026-01-02");
  });
  it("logs code/message from plain-object errors", () => {
    expect(errInfo({ code: "23505", message: "dup" })).toEqual({ code: "23505", message: "dup" });
    expect(errInfo(new Error("boom"))).toEqual({ message: "boom" });
  });
});
