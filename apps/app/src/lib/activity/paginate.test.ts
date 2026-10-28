import { describe, expect, it } from "vitest";
import type { ActivityFeedRow } from "@/types/database";
import { PAGE_SIZE, paginate, parseFilters } from "./paginate";

const row = (i: number) =>
  ({ id: String(i), occurred_at: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z` }) as ActivityFeedRow;

describe("paginate", () => {
  it("has no cursor when everything fits", () => {
    const r = paginate([row(1), row(2)]);
    expect(r.items).toHaveLength(2);
    expect(r.nextCursor).toBeNull();
  });

  it("drops the sentinel row and cursors on the last kept row", () => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => row(i));
    const r = paginate(rows);
    expect(r.items).toHaveLength(PAGE_SIZE);
    expect(r.nextCursor).toBe(rows[PAGE_SIZE - 1].occurred_at);
  });
});

describe("parseFilters", () => {
  it("takes first array value and drops blanks", () => {
    expect(parseFilters({ type: ["stamp", "x"], card: "" })).toMatchObject({
      type: "stamp",
      card: undefined,
    });
  });

  it("ignores an invalid cursor", () => {
    expect(parseFilters({ cursor: "nope" }).cursor).toBeUndefined();
    expect(parseFilters({ cursor: "2026-01-01T00:00:00Z" }).cursor).toBe(
      "2026-01-01T00:00:00Z",
    );
  });
});
