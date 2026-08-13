import { describe, expect, it } from "vitest";
import { computeStampGrid } from "./stamp-layout";

describe("computeStampGrid", () => {
  it("lays out goal <= 5 as a single row of `goal` slots", () => {
    const grid = computeStampGrid(2, 4);
    expect(grid.proportional).toBe(false);
    expect(grid.totalSlots).toBe(4);
    expect(grid.rows).toEqual([
      [{ filled: true }, { filled: true }, { filled: false }, { filled: false }],
    ]);
  });

  it("lays out a goal of exactly 5 as a single row", () => {
    const grid = computeStampGrid(5, 5);
    expect(grid.rows.length).toBe(1);
    expect(grid.rows[0].length).toBe(5);
    expect(grid.rows[0].every((s) => s.filled)).toBe(true);
  });

  it("splits 6..10 into two balanced rows, extra slot on top", () => {
    const grid = computeStampGrid(3, 8);
    expect(grid.proportional).toBe(false);
    expect(grid.totalSlots).toBe(8);
    expect(grid.rows.map((r) => r.length)).toEqual([4, 4]);
    // 3 filled, filled left-to-right, row-major (top row first)
    expect(grid.rows[0].map((s) => s.filled)).toEqual([true, true, true, false]);
    expect(grid.rows[1].map((s) => s.filled)).toEqual([false, false, false, false]);
  });

  it("gives the top row the extra slot for an odd goal in 6..10", () => {
    const grid = computeStampGrid(0, 7);
    expect(grid.rows.map((r) => r.length)).toEqual([4, 3]);
  });

  it("caps at exactly 10 slots for goal === 10", () => {
    const grid = computeStampGrid(10, 10);
    expect(grid.proportional).toBe(false);
    expect(grid.totalSlots).toBe(10);
    expect(grid.rows.map((r) => r.length)).toEqual([5, 5]);
  });

  it("represents goal > 10 proportionally across 10 slots", () => {
    const grid = computeStampGrid(23, 30);
    expect(grid.proportional).toBe(true);
    expect(grid.totalSlots).toBe(10);
    // round(23/30*10) = round(7.667) = 8
    const filledCount = grid.rows.flat().filter((s) => s.filled).length;
    expect(filledCount).toBe(8);
    expect(grid.rows.map((r) => r.length)).toEqual([5, 5]);
  });

  it("never exceeds 10 filled slots even at/above full progress for a large goal", () => {
    const grid = computeStampGrid(500, 500);
    expect(grid.totalSlots).toBe(10);
    const filledCount = grid.rows.flat().filter((s) => s.filled).length;
    expect(filledCount).toBe(10);
  });

  it("clamps negative/zero/fractional progress and goal defensively", () => {
    expect(computeStampGrid(-5, 4).rows.flat().filter((s) => s.filled).length).toBe(0);
    expect(() => computeStampGrid(2, 0)).not.toThrow();
    expect(computeStampGrid(2.9, 4.9).totalSlots).toBe(4);
  });
});
