import { describe, expect, it } from "vitest";
import { newAppleSerial, newBarcodeValue, newPassAuthToken } from "./tokens";

const AMBIGUOUS = /[0O1Il]/;
const ALPHABET_RE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

describe("newBarcodeValue", () => {
  it("starts with the stmp_ prefix", () => {
    expect(newBarcodeValue()).toMatch(/^stmp_/);
  });

  it("has a 12-character suffix using only the safe alphabet", () => {
    const value = newBarcodeValue();
    const suffix = value.slice("stmp_".length);
    expect(suffix).toHaveLength(12);
    expect(suffix).toMatch(ALPHABET_RE);
    expect(suffix).not.toMatch(AMBIGUOUS);
  });

  it("generates unique values across many calls", () => {
    const values = new Set(Array.from({ length: 500 }, () => newBarcodeValue()));
    expect(values.size).toBe(500);
  });
});

describe("newPassAuthToken", () => {
  it("is 32 characters from the safe alphabet", () => {
    const token = newPassAuthToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(ALPHABET_RE);
    expect(token).not.toMatch(AMBIGUOUS);
  });

  it("generates unique values across many calls", () => {
    const values = new Set(
      Array.from({ length: 500 }, () => newPassAuthToken()),
    );
    expect(values.size).toBe(500);
  });
});

describe("newAppleSerial", () => {
  it("is 12 characters from the safe alphabet", () => {
    const serial = newAppleSerial();
    expect(serial).toHaveLength(12);
    expect(serial).toMatch(ALPHABET_RE);
    expect(serial).not.toMatch(AMBIGUOUS);
  });

  it("generates unique values across many calls", () => {
    const values = new Set(
      Array.from({ length: 500 }, () => newAppleSerial()),
    );
    expect(values.size).toBe(500);
  });
});
