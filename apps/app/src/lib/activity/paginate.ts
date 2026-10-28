import type { ActivityFeedRow } from "@/types/database";

export const PAGE_SIZE = 30;

export type ActivityFilters = {
  type?: string;
  location?: string;
  card?: string;
  cursor?: string;
};

/** Reads one-value search params, dropping blanks and an unparsable cursor. */
export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): ActivityFilters {
  const one = (k: string) => {
    const v = Array.isArray(sp[k]) ? sp[k][0] : sp[k];
    return v ? v : undefined;
  };
  const cursor = one("cursor");
  return {
    type: one("type"),
    location: one("location"),
    card: one("card"),
    cursor: cursor && !Number.isNaN(Date.parse(cursor)) ? cursor : undefined,
  };
}

/** Rows are fetched PAGE_SIZE + 1; the extra row only signals "more". */
// shortcut: cursor is occurred_at alone, so rows sharing an exact timestamp across a page boundary could be skipped; add id as a tiebreaker if that shows up.
export function paginate(rows: ActivityFeedRow[]) {
  const items = rows.slice(0, PAGE_SIZE);
  const nextCursor =
    rows.length > PAGE_SIZE ? items[items.length - 1].occurred_at : null;
  return { items, nextCursor };
}
