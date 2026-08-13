import { describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getOverviewStats } from "./stats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createClientMock = createClient as any;

describe("getOverviewStats", () => {
  it("returns the counts from each table", async () => {
    const mock = makeSupabaseMock({
      customers: { count: 12 },
      cards: { count: 8 },
      stamp_events: { count: 3 },
      redemptions: { count: 5 },
    });
    createClientMock.mockResolvedValue(mock);

    const stats = await getOverviewStats("biz-1");
    expect(stats).toEqual({
      customers: 12,
      activeCards: 8,
      stampsThisWeek: 3,
      redemptions: 5,
    });
  });

  it("falls back to 0 for any null count", async () => {
    const mock = makeSupabaseMock({
      customers: { count: null },
      cards: { count: null },
      stamp_events: { count: null },
      redemptions: { count: null },
    });
    createClientMock.mockResolvedValue(mock);

    const stats = await getOverviewStats("biz-1");
    expect(stats).toEqual({
      customers: 0,
      activeCards: 0,
      stampsThisWeek: 0,
      redemptions: 0,
    });
  });

  it("scopes every query to the given business id", async () => {
    const mock = makeSupabaseMock({
      customers: { count: 1 },
      cards: { count: 1 },
      stamp_events: { count: 1 },
      redemptions: { count: 1 },
    });
    createClientMock.mockResolvedValue(mock);

    await getOverviewStats("biz-42");
    expect(mock.builderFor("customers").eq).toHaveBeenCalledWith(
      "business_id",
      "biz-42",
    );
    expect(mock.builderFor("cards").eq).toHaveBeenCalledWith(
      "business_id",
      "biz-42",
    );
    expect(mock.builderFor("cards").in).toHaveBeenCalledWith("status", [
      "active",
      "completed",
    ]);
    expect(mock.builderFor("stamp_events").eq).toHaveBeenCalledWith(
      "business_id",
      "biz-42",
    );
    expect(mock.builderFor("redemptions").eq).toHaveBeenCalledWith(
      "business_id",
      "biz-42",
    );
  });
});
