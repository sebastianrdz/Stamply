import { describe, expect, it, vi } from "vitest";
import { getReviewStats } from "./stats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = (rpc: any) => ({ rpc }) as any;

describe("getReviewStats", () => {
  it("maps the RPC row and asks for the last 90 days", async () => {
    const rpc = vi.fn(async () => ({ data: [{ clicks: 5, clickers: 3 }], error: null }));
    const r = await getReviewStats(client(rpc), "b1", 90, new Date("2026-11-14T00:00:00Z"));
    expect(r).toEqual({ clicks: 5, clickers: 3 });
    expect(rpc).toHaveBeenCalledWith("review_clicks_summary", {
      p_business_id: "b1",
      p_since: "2026-08-16T00:00:00.000Z",
    });
  });

  it("returns zeros for an empty result and throws on error", async () => {
    expect(
      await getReviewStats(client(async () => ({ data: [], error: null })), "b1"),
    ).toEqual({ clicks: 0, clickers: 0 });
    await expect(
      getReviewStats(client(async () => ({ data: null, error: { code: "X" } })), "b1"),
    ).rejects.toEqual({ code: "X" });
  });
});
