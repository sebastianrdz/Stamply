/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import { getReferralStats } from "./stats";

const client = (cfg: Record<string, any>) =>
  ({ from: makeSupabaseMock(cfg).from }) as any;

describe("getReferralStats", () => {
  it("returns referred and rewarded counts", async () => {
    const r = await getReferralStats(
      client({ referrals: [{ count: 7 }, { count: 3 }] }),
      "b1",
      30,
    );
    expect(r).toEqual({ referred: 7, rewarded: 3 });
  });

  it("treats null counts as zero and throws on error", async () => {
    expect(
      await getReferralStats(client({ referrals: { count: null } }), "b1", 30),
    ).toEqual({ referred: 0, rewarded: 0 });
    await expect(
      getReferralStats(
        client({ referrals: { error: { message: "x" } } }),
        "b1",
        30,
      ),
    ).rejects.toEqual({ message: "x" });
  });

  it("windows both queries by the number of days", async () => {
    const mock = makeSupabaseMock({ referrals: { count: 0 } });
    await getReferralStats(
      { from: mock.from } as any,
      "b1",
      7,
      new Date("2026-11-14T00:00:00Z"),
    );
    expect(mock.builderFor("referrals", 0).gte).toHaveBeenCalledWith(
      "created_at",
      "2026-11-07T00:00:00.000Z",
    );
    expect(mock.builderFor("referrals", 1).gte).toHaveBeenCalledWith(
      "rewarded_at",
      "2026-11-07T00:00:00.000Z",
    );
  });
});
