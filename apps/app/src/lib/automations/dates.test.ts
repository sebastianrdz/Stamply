import { describe, expect, it } from "vitest";
import {
  almostThere,
  birthdayTrigger,
  reminderBucketKey,
  winBackKey,
} from "./dates";

const at = (s: string) => new Date(s);

describe("birthdayTrigger", () => {
  it("fires `day` on the birthday and `pre` N days before", () => {
    expect(birthdayTrigger("1990-08-28", "UTC", at("2026-08-28T10:00:00Z"), 3)).toEqual({
      periodKey: "2026-day",
      days: 0,
    });
    expect(birthdayTrigger("1990-08-28", "UTC", at("2026-08-25T10:00:00Z"), 3)).toEqual({
      periodKey: "2026-pre",
      days: 3,
    });
  });
  it("is silent on other days or with no birthday", () => {
    expect(birthdayTrigger("1990-08-28", "UTC", at("2026-08-26T10:00:00Z"), 3)).toBeNull();
    expect(birthdayTrigger(null, "UTC", at("2026-08-28T10:00:00Z"), 3)).toBeNull();
    expect(birthdayTrigger("1990-08-28", "UTC", at("2026-08-25T10:00:00Z"), 0)).toBeNull();
  });
  it("crosses the year boundary and uses the business timezone", () => {
    expect(birthdayTrigger("1990-01-02", "UTC", at("2026-12-30T10:00:00Z"), 3)).toEqual({
      periodKey: "2027-pre",
      days: 3,
    });
    // 03:00 UTC on the 29th is still the 28th in New York.
    expect(
      birthdayTrigger("1990-08-28", "America/New_York", at("2026-08-29T03:00:00Z"), 0),
    ).toEqual({ periodKey: "2026-day", days: 0 });
  });
  it("moves a Feb 29 birthday to Feb 28 in common years", () => {
    expect(birthdayTrigger("1992-02-29", "UTC", at("2026-02-28T10:00:00Z"), 0)?.periodKey).toBe("2026-day");
    expect(birthdayTrigger("1992-02-29", "UTC", at("2028-02-28T10:00:00Z"), 0)).toBeNull();
  });
});

describe("reminderBucketKey", () => {
  it("is stable inside a bucket and changes after N days", () => {
    const a = reminderBucketKey("UTC", at("2026-08-10T01:00:00Z"), 14);
    const b = reminderBucketKey("UTC", at("2026-08-10T23:00:00Z"), 14);
    expect(a).toBe(b);
    const days = new Set(
      Array.from({ length: 28 }, (_, i) =>
        reminderBucketKey("UTC", new Date(Date.UTC(2026, 7, 1 + i)), 14),
      ),
    );
    expect(days.size).toBeGreaterThanOrEqual(2);
    expect(days.size).toBeLessThanOrEqual(3);
  });
});

describe("winBackKey", () => {
  const now = at("2026-09-30T12:00:00Z");
  it("returns the last-visit date once the lapse reaches N days", () => {
    expect(winBackKey(at("2026-08-31T12:00:00Z"), 30, "UTC", now)).toBe("2026-08-31");
  });
  it("is null while the customer is still active", () => {
    expect(winBackKey(at("2026-09-02T12:00:00Z"), 30, "UTC", now)).toBeNull();
  });
});

describe("almostThere", () => {
  it("fires when within `remaining` of the goal, keyed by reward cycle", () => {
    expect(almostThere(8, 10, 2)).toEqual({ left: 2, cycle: 0 });
    expect(almostThere(19, 10, 2)).toEqual({ left: 1, cycle: 1 });
  });
  it("does not fire too early, at the goal, or right after a reset", () => {
    expect(almostThere(7, 10, 2)).toBeNull();
    expect(almostThere(10, 10, 2)).toBeNull();
    expect(almostThere(0, 10, 2)).toBeNull();
  });
});
