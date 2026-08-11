/**
 * Pure layout math for the wallet "stamp grid" visual. No I/O, no rendering —
 * kept separate from stamp-image.ts so the slot-count/row/proportional-fill
 * logic is trivially unit-testable without a rasterizer.
 *
 * Hard rule: at most 10 stamps, at most 2 rows (5 per row).
 *  - goal <= 5           -> one row of `goal` slots
 *  - 6 <= goal <= 10      -> two balanced rows (top row gets the extra slot)
 *  - goal > 10            -> 10 slots as a PROPORTIONAL representation;
 *                            exact progress/goal is left to header text.
 */

export interface StampSlot {
  filled: boolean;
}

export interface StampGridLayout {
  /** Slots grouped into 1 or 2 rows, top-to-bottom. */
  rows: StampSlot[][];
  /** Total slot count across all rows (<= 10). */
  totalSlots: number;
  /** True when the grid is a representational fraction of `goal` (goal > 10), not an exact count. */
  proportional: boolean;
}

export function computeStampGrid(
  progress: number,
  goal: number,
): StampGridLayout {
  const safeGoal = Math.max(1, Math.floor(goal) || 1);
  const safeProgress = Math.max(0, Math.floor(progress) || 0);

  let slotCount: number;
  let filledCount: number;
  let proportional = false;

  if (safeGoal <= 10) {
    slotCount = safeGoal;
    filledCount = Math.min(safeProgress, slotCount);
  } else {
    slotCount = 10;
    proportional = true;
    filledCount = Math.min(
      slotCount,
      Math.round((safeProgress / safeGoal) * slotCount),
    );
  }

  const rowCounts =
    slotCount <= 5
      ? [slotCount]
      : [Math.ceil(slotCount / 2), Math.floor(slotCount / 2)];

  let remaining = filledCount;
  const rows: StampSlot[][] = rowCounts.map((count) =>
    Array.from({ length: count }, () => {
      const filled = remaining > 0;
      if (filled) remaining--;
      return { filled };
    }),
  );

  return { rows, totalSlots: slotCount, proportional };
}
