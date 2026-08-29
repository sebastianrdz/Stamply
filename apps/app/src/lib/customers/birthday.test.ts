import { describe, expect, it, vi } from "vitest";
import { birthdayMonthWindow, isBirthdayMonth } from "./birthday";

describe("isBirthdayMonth", () => {
  it("matches any day within the birthday's month, in the given timezone", () => {
    const now = new Date("2026-08-29T12:00:00Z");
    // Birthday's day-of-month (01) differs from today's (29) — only the
    // month has to match, since the reward is redeemable all birthday month.
    expect(isBirthdayMonth("1990-08-01", "UTC", now)).toBe(true);
    expect(isBirthdayMonth("1990-08-31", "UTC", now)).toBe(true);
  });

  it("does not match a different month", () => {
    const now = new Date("2026-08-29T12:00:00Z");
    expect(isBirthdayMonth("1990-09-01", "UTC", now)).toBe(false);
  });

  it("returns false when the customer has no birthday on file", () => {
    const now = new Date("2026-08-29T12:00:00Z");
    expect(isBirthdayMonth(null, "UTC", now)).toBe(false);
  });

  it("uses the business's timezone, not UTC, near a DST transition", () => {
    // 2026-03-08 is the US DST transition (2nd Sunday of March): clocks
    // spring forward from EST (-05:00) to EDT (-04:00) at 2am local. At
    // 12:00 UTC the zone is already in EDT, and the local wall-clock month
    // is still March — the birthday should still match.
    const now = new Date("2026-03-08T12:00:00Z");
    expect(isBirthdayMonth("1990-03-25", "America/New_York", now)).toBe(true);
    expect(isBirthdayMonth("1990-04-01", "America/New_York", now)).toBe(
      false,
    );
  });

  it("is timezone-aware across a year boundary (already next month in a positive-offset zone)", () => {
    // 2025-12-31T20:00:00Z is still December in UTC, but already 2026-01-01
    // 05:00 in Asia/Tokyo (UTC+9) — the birthday match must use the
    // business's timezone, not UTC.
    const now = new Date("2025-12-31T20:00:00Z");
    expect(isBirthdayMonth("2020-01-15", "Asia/Tokyo", now)).toBe(true);
    // Sanity: the same instant, read in UTC, is still December and would not match.
    expect(isBirthdayMonth("2020-01-15", "UTC", now)).toBe(false);
  });

  it("falls back to UTC (without throwing) for an invalid timezone", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const now = new Date("2026-08-29T12:00:00Z");
    expect(isBirthdayMonth("1990-08-01", "Not/AZone", now)).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("birthdayMonthWindow", () => {
  it("spans the start of the local calendar month to the start of the next, in UTC", () => {
    const now = new Date("2026-08-29T12:00:00Z");
    const { start, end } = birthdayMonthWindow("UTC", now);
    expect(start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("handles a non-whole-hour offset (Asia/Kolkata, GMT+05:30)", () => {
    // Local start-of-month 2026-08-01 00:00 IST = 2026-07-31T18:30:00Z.
    const now = new Date("2026-08-29T12:00:00Z"); // still August in IST
    const { start, end } = birthdayMonthWindow("Asia/Kolkata", now);
    expect(start.toISOString()).toBe("2026-07-31T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-08-31T18:30:00.000Z");
  });

  it("resolves each month boundary's own DST offset independently (America/New_York, March 2026)", () => {
    const now = new Date("2026-03-08T12:00:00Z");
    const { start, end } = birthdayMonthWindow("America/New_York", now);
    // Start of March (still EST, -05:00) -> 05:00 UTC.
    expect(start.toISOString()).toBe("2026-03-01T05:00:00.000Z");
    // Start of April (already EDT, -04:00) -> 04:00 UTC.
    expect(end.toISOString()).toBe("2026-04-01T04:00:00.000Z");
  });

  it("is timezone-aware across a year boundary (Asia/Tokyo)", () => {
    const now = new Date("2025-12-31T20:00:00Z"); // already January 2026 in Tokyo
    const { start, end } = birthdayMonthWindow("Asia/Tokyo", now);
    expect(start.toISOString()).toBe("2025-12-31T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-31T15:00:00.000Z");
  });

  it("falls back to UTC (without throwing) for an invalid timezone", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const now = new Date("2026-08-29T12:00:00Z");
    const { start, end } = birthdayMonthWindow("Not/AZone", now);
    expect(start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
