import { describe, expect, it } from "vitest";
import { redactSensitivePath } from "./redact-url";

describe("redactSensitivePath", () => {
  it("redacts a card bearer token path", () => {
    expect(redactSensitivePath("/c/tok_aBc123XyZ789")).toBe("/c/[redacted]");
  });

  it("redacts a card bearer token path but preserves the query string", () => {
    expect(redactSensitivePath("/c/tok_aBc123XyZ789?foo=bar")).toBe(
      "/c/[redacted]?foo=bar",
    );
  });

  it("redacts a team-invite token path", () => {
    expect(redactSensitivePath("/join/V1StGXR8_Z5jdHi6B-myT")).toBe(
      "/join/[redacted]",
    );
  });

  it("does NOT redact /c/join/<programId> — the enrollment route, not a card-token route", () => {
    expect(redactSensitivePath("/c/join/prog-123")).toBe("/c/join/prog-123");
  });

  it("leaves an unrelated path unchanged", () => {
    expect(redactSensitivePath("/dashboard/programs")).toBe(
      "/dashboard/programs",
    );
  });

  it("leaves the root path unchanged", () => {
    expect(redactSensitivePath("/")).toBe("/");
  });
});
