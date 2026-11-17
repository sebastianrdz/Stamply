/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import { getDeliveryProgress } from "./delivery";

function client(opts: { status?: Record<string, any>; gaveUp?: any[] }) {
  const db = makeSupabaseMock({
    wallet_offer_recipients: { data: opts.gaveUp ?? [] },
  });
  const rpc = vi.fn(async (_fn: string, args: { p_offer_id: string }) => ({
    data: opts.status?.[args.p_offer_id] ? [opts.status[args.p_offer_id]] : [],
    error: null,
  }));
  return { c: { from: db.from, rpc } as any, rpc, db };
}

describe("getDeliveryProgress", () => {
  it("reads live counts only for offers still being delivered", async () => {
    const { c, rpc } = client({
      status: { p1: { delivered: 40, pending: 10, failed: 1 } },
    });
    const r = await getDeliveryProgress(c, [
      { id: "p1", delivery: "pending" },
      { id: "d1", delivery: "done" },
    ]);
    expect(r.get("p1")).toEqual({ delivered: 40, pending: 10, failed: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("offer_delivery_status", {
      p_offer_id: "p1",
    });
  });

  it("counts recipients that gave up on finished offers, per offer", async () => {
    const { c, db } = client({
      gaveUp: [
        { offer_id: "d1", customer_id: "a" },
        { offer_id: "d1", customer_id: "b" },
        { offer_id: "d2", customer_id: "c" },
      ],
    });
    const r = await getDeliveryProgress(c, [
      { id: "d1", delivery: "done" },
      { id: "d2" },
      { id: "d3", delivery: "done" },
    ]);
    expect(r.get("d1")?.failed).toBe(2);
    expect(r.get("d2")?.failed).toBe(1);
    expect(r.has("d3")).toBe(false);
    expect(db.builderFor("wallet_offer_recipients").gte).toHaveBeenCalledWith(
      "attempts",
      3,
    );
  });

  it("makes no queries for an empty list and tolerates an empty RPC result", async () => {
    const { c, rpc, db } = client({});
    expect((await getDeliveryProgress(c, [])).size).toBe(0);
    expect(db.from).not.toHaveBeenCalled();
    const r = await getDeliveryProgress(c, [{ id: "p9", delivery: "pending" }]);
    expect(r.get("p9")).toEqual({ delivered: 0, pending: 0, failed: 0 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
