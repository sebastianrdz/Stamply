/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeQueryBuilder } from "@/lib/test-utils/supabase-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/wallet/notify", () => ({
  notifyCardUpdatedForBirthday: vi.fn(),
}));
vi.mock("@/lib/rewards/queries", () => ({ grantStandaloneReward: vi.fn() }));

let clockMs = 0;
let msPerDelivery = 10;
const deliverMock = vi.fn(async (..._a: unknown[]) => {
  clockMs += msPerDelivery;
  return "sent" as const;
});
vi.mock("./deliver", () => ({
  deliverAutomation: (...a: unknown[]) => deliverMock(...a),
}));

import { runCronAutomations } from "./cron";

const DAY = 86_400_000;
const def = (id: string) => ({
  id,
  business_id: `biz-${id}`,
  type: "win_back",
  active: true,
  message: "hi",
  config: {},
  reward_description: null,
  business: { name: "B", timezone: "UTC" },
});
const customers = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    full_name: `Name ${i}`,
    marketing_consent: true,
    birthday: null,
  }));

function admin(defs: any[], n: number) {
  const list = customers(n);
  return {
    from: (table: string) =>
      makeQueryBuilder({ data: table === "reward_definitions" ? defs : list }),
    rpc: () =>
      makeQueryBuilder({
        data: list.map((c) => ({
          customer_id: c.id,
          last_visit: "2020-01-01T00:00:00Z",
        })),
      }),
  } as any;
}
const run = (
  a: any,
  budgetMs?: number,
  now = new Date("2026-11-16T13:00:00Z"),
) => runCronAutomations(a, now, { budgetMs, clock: () => clockMs });

beforeEach(() => {
  clockMs = 0;
  msPerDelivery = 10;
  deliverMock.mockClear();
});

describe("runCronAutomations time budget", () => {
  it("runs everything and defers nothing without a budget", async () => {
    const c = await run(admin([def("a"), def("b"), def("c")], 5));
    expect(c).toMatchObject({ checkedAutomations: 3, sent: 15, deferred: 0 });
  });

  it("defers every automation when the budget is already spent", async () => {
    const c = await run(admin([def("a"), def("b"), def("c")], 5), 0);
    expect(c).toMatchObject({ checkedAutomations: 0, sent: 0, deferred: 3 });
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it("finishes the automation in flight, then defers the rest", async () => {
    // First automation (5 sends, 50 ms of fake time) starts inside the 25 ms budget.
    const c = await run(admin([def("a"), def("b"), def("c")], 5), 25);
    expect(c).toMatchObject({ checkedAutomations: 1, sent: 5, deferred: 2 });
  });

  it("stops between batches of a big automation and reports it as deferred", async () => {
    msPerDelivery = 1; // 20 sends in the first batch push the fake clock past the budget
    const c = await run(admin([def("a")], 45), 10);
    expect(c).toMatchObject({ checkedAutomations: 1, sent: 20, deferred: 1 });
  });
});

describe("runCronAutomations rotation", () => {
  const order = () => [
    ...new Set(
      deliverMock.mock.calls.map((call) => (call[1] as { id: string }).id),
    ),
  ];

  it("starts at a different automation each day so the end of the list can't starve", async () => {
    const defs = [def("a"), def("b"), def("c")];
    // A day (after the fake customers' 2020 last visit) whose index is a multiple of 3.
    let day = Math.floor(Date.UTC(2030, 0, 1) / DAY);
    while (day % 3 !== 0) day++;
    await run(admin(defs, 1), undefined, new Date(day * DAY)); // start index 0
    expect(order()).toEqual(["a", "b", "c"]);
    deliverMock.mockClear();
    await run(admin(defs, 1), undefined, new Date((day + 1) * DAY)); // start index 1
    expect(order()).toEqual(["b", "c", "a"]);
  });

  it("handles no automations", async () => {
    expect(await run(admin([], 0))).toMatchObject({
      checkedAutomations: 0,
      deferred: 0,
    });
  });
});
