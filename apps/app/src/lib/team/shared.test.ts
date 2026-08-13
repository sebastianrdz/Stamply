import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isInviteExpired } from "./shared";

describe("isInviteExpired", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for a date in the past", () => {
    expect(isInviteExpired("2026-07-01T00:00:00.000Z")).toBe(true);
  });

  it("returns false for a date in the future", () => {
    expect(isInviteExpired("2026-09-01T00:00:00.000Z")).toBe(false);
  });

  it("returns false at the exact current instant (not strictly in the past)", () => {
    expect(isInviteExpired("2026-08-01T12:00:00.000Z")).toBe(false);
  });

  it("returns true one millisecond after the current instant has passed", () => {
    vi.setSystemTime(new Date("2026-08-01T12:00:00.001Z"));
    expect(isInviteExpired("2026-08-01T12:00:00.000Z")).toBe(true);
  });
});
