import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getAnalytics } from "./analytics";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createClientMock = createClient as any;

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Mirrors the exact date arithmetic `getAnalytics` uses to bucket days, so
 * expectations stay correct regardless of the host machine's timezone. */
function expectedBuckets(now: Date) {
  const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    return { date, label: WEEKDAY[new Date(date + "T00:00:00").getDay()] };
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getAnalytics", () => {
  it("produces exactly 14 daily points with dates/labels matching the 14-day window", async () => {
    const buckets = expectedBuckets(new Date());
    const mock = makeSupabaseMock({
      stamp_events: { data: [] },
      redemptions: { count: 0 },
      cards: { count: 0 },
    });
    createClientMock.mockResolvedValue(mock);

    const analytics = await getAnalytics("biz-1");

    expect(analytics.daily).toHaveLength(14);
    expect(analytics.daily.map((d) => d.date)).toEqual(
      buckets.map((b) => b.date),
    );
    expect(analytics.daily.map((d) => d.label)).toEqual(
      buckets.map((b) => b.label),
    );
  });

  it("buckets stamp events onto the correct day and sums totalStamps", async () => {
    const buckets = expectedBuckets(new Date());
    const firstDay = buckets[0].date;
    const midDay = buckets[5].date;
    const lastDay = buckets[13].date;

    const mock = makeSupabaseMock({
      stamp_events: {
        data: [
          { created_at: `${firstDay}T08:00:00.000Z`, kind: "stamp" },
          { created_at: `${midDay}T09:00:00.000Z`, kind: "stamp" },
          { created_at: `${midDay}T10:00:00.000Z`, kind: "stamp" },
          { created_at: `${lastDay}T23:00:00.000Z`, kind: "stamp" },
        ],
      },
      redemptions: { count: 2 },
      cards: { count: 10 },
    });
    createClientMock.mockResolvedValue(mock);

    const analytics = await getAnalytics("biz-1");

    expect(analytics.daily[0].stamps).toBe(1);
    expect(analytics.daily[5].stamps).toBe(2);
    expect(analytics.daily[13].stamps).toBe(1);
    expect(analytics.totalStamps).toBe(4);
    // All other buckets should be 0.
    const nonZero = analytics.daily.filter((d) => d.stamps > 0);
    expect(nonZero).toHaveLength(3);
  });

  it("computes redemptionRate as redemptions / cardsIssued", async () => {
    const mock = makeSupabaseMock({
      stamp_events: { data: [] },
      redemptions: { count: 5 },
      cards: { count: 20 },
    });
    createClientMock.mockResolvedValue(mock);

    const analytics = await getAnalytics("biz-1");
    expect(analytics.totalRedemptions).toBe(5);
    expect(analytics.activeCards).toBe(20);
    expect(analytics.redemptionRate).toBe(0.25);
  });

  it("avoids divide-by-zero: redemptionRate is 0 when no cards have been issued", async () => {
    const mock = makeSupabaseMock({
      stamp_events: { data: [] },
      redemptions: { count: 0 },
      cards: { count: 0 },
    });
    createClientMock.mockResolvedValue(mock);

    const analytics = await getAnalytics("biz-1");
    expect(analytics.redemptionRate).toBe(0);
  });

  it("falls back to 0 for null redemptions/cards counts", async () => {
    const mock = makeSupabaseMock({
      stamp_events: { data: null },
      redemptions: { count: null },
      cards: { count: null },
    });
    createClientMock.mockResolvedValue(mock);

    const analytics = await getAnalytics("biz-1");
    expect(analytics.totalRedemptions).toBe(0);
    expect(analytics.activeCards).toBe(0);
    expect(analytics.totalStamps).toBe(0);
    expect(analytics.redemptionRate).toBe(0);
  });
});
