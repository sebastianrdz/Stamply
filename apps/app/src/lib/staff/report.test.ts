import { describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import { dailyFor, getEmployeeReport, summarize } from "./report";

const row = (
  employee_id: string | null,
  day: string,
  stamps = 0,
  redemptions = 0,
  overrides = 0,
) => ({
  employee_id,
  day,
  stamps,
  redemptions,
  overrides,
});
const names = new Map([
  ["e1", "ana@x.com"],
  ["e2", "bob@x.com"],
]);

describe("summarize", () => {
  it("totals per staff, counts active days, sorts busiest first", () => {
    const out = summarize(
      [
        row("e1", "2026-11-12", 4, 1),
        row("e1", "2026-11-13", 2, 0, 1),
        row("e1", "2026-11-14", 0, 0, 1), // override-only day is not an active day
        row("e2", "2026-11-14", 10, 0),
      ],
      names,
    );
    expect(out.map((s) => s.key)).toEqual(["e2", "e1"]);
    expect(out[1]).toMatchObject({
      name: "ana@x.com",
      stamps: 6,
      redemptions: 1,
      overrides: 2,
      activeDays: 2,
      stampsPerActiveDay: 3,
    });
  });

  it("shows removed members and deleted accounts as nameless rows", () => {
    const out = summarize(
      [row("gone", "2026-11-14", 1), row(null, "2026-11-14", 2)],
      names,
    );
    expect(out.find((s) => s.key === "gone")?.name).toBeNull();
    expect(out.find((s) => s.key === "deleted")).toMatchObject({
      name: null,
      stamps: 2,
    });
  });

  it("returns nothing for an empty period", () => {
    expect(summarize([], names)).toEqual([]);
  });
});

describe("dailyFor", () => {
  it("returns one staff member's days newest first", () => {
    const rows = [
      row("e1", "2026-11-12", 1),
      row("e2", "2026-11-13", 9),
      row("e1", "2026-11-14", 2),
    ];
    expect(dailyFor(rows, "e1").map((r) => r.day)).toEqual([
      "2026-11-14",
      "2026-11-12",
    ]);
    expect(dailyFor([row(null, "2026-11-14", 1)], "deleted")).toHaveLength(1);
  });
});

describe("getEmployeeReport", () => {
  it("asks for the local-date window and joins names from memberships", async () => {
    const db = makeSupabaseMock({
      memberships: {
        data: [
          { user_id: "e1", email: "ana@x.com" },
          { user_id: "e2", email: null },
        ],
      },
    });
    const rpc = vi.fn(async () => ({
      data: [row("e1", "2026-11-14", 3), row("e2", "2026-11-14", 1)],
      error: null,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = { from: db.from, rpc } as any;
    const r = await getEmployeeReport(
      client,
      { id: "b1", timezone: "UTC" },
      7,
      new Date("2026-11-14T12:00:00Z"),
    );
    expect(rpc).toHaveBeenCalledWith("employee_activity", {
      p_business_id: "b1",
      p_from: "2026-11-08",
      p_to: "2026-11-14",
      p_tz: "UTC",
    });
    expect(r.staff.find((s) => s.key === "e1")?.name).toBe("ana@x.com");
    expect(r.staff.find((s) => s.key === "e2")?.name).toBeNull(); // no email on file
  });

  it("throws when the RPC fails", async () => {
    const db = makeSupabaseMock({ memberships: { data: [] } });
    const rpc = vi.fn(async () => ({ data: null, error: { code: "X" } }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = { from: db.from, rpc } as any;
    await expect(
      getEmployeeReport(client, { id: "b1", timezone: "UTC" }, 7),
    ).rejects.toEqual({ code: "X" });
  });
});
