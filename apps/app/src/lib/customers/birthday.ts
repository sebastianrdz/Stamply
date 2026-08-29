import "server-only";

/**
 * Resolve a (possibly invalid/unrecognized) IANA timezone to itself, or fall
 * back to "UTC" with a warning. `businesses.timezone` has no existing
 * validation constraining it to real IANA identifiers, so both functions in
 * this module must defend against `Intl.DateTimeFormat` throwing a
 * `RangeError` on construction rather than let that propagate into wallet
 * rendering / the birthday cron.
 */
function safeTimezone(timezone: string): string {
  try {
    // Constructing (not just using) the formatter is what throws on an
    // unrecognized zone, so do a throwaway construction purely to validate.
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch (e) {
    if (e instanceof RangeError) {
      console.warn(
        `[birthday] invalid/unrecognized timezone "${timezone}", falling back to UTC`,
        e,
      );
      return "UTC";
    }
    throw e;
  }
}

/**
 * Returns true if `now`, expressed as a wall-clock date in `timezone`, falls
 * in the same calendar month as `birthday` (a `YYYY-MM-DD` date string) —
 * the reward is redeemable for the customer's ENTIRE birthday month, not
 * just the exact day (e.g. a 1990-08-28 birthday matches all of August).
 * `birthday === null` (no birthday on file) is never a match.
 */
export function isBirthdayMonth(
  birthday: string | null,
  timezone: string,
  now = new Date(),
): boolean {
  if (birthday === null) return false;
  const tz = safeTimezone(timezone);
  const todayMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    month: "2-digit",
  }).format(now);
  return todayMonth === birthday.slice(5, 7);
}

/** The UTC-millisecond numeric offset (e.g. -300 for GMT-05:00, +330 for GMT+05:30). */
function offsetMinutesAt(timezone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  }).formatToParts(instant);
  // Bare "GMT" (no +HH:MM suffix) means UTC itself, i.e. a zero offset.
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(tzName);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * (hours * 60 + minutes);
}

function localMonthPartsAt(
  timezone: string,
  instant: Date,
): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") };
}

/**
 * The UTC instant range [start of local calendar month, start of next local
 * calendar month) for `now`'s month in `timezone` — the window during which
 * the customer's birthday reward is relevant/redeemable. Correct across
 * non-whole-hour offsets (e.g. GMT+05:30) and a DST transition falling
 * somewhere inside the month: each boundary's offset is resolved
 * independently, by sampling the actual UTC offset in effect at that
 * boundary rather than assuming a single fixed offset for the whole month.
 */
export function birthdayMonthWindow(
  timezone: string,
  now = new Date(),
): { start: Date; end: Date } {
  const tz = safeTimezone(timezone);
  const { year, month } = localMonthPartsAt(tz, now);

  // Treat the local Y-M-01 (start of month) as if it were itself a UTC
  // wall-clock time (a "naive" guess), then correct it by the zone's real
  // offset at that instant to get the true UTC instant of local
  // start-of-month. A month's DST transition happens at a fixed local
  // wall-clock hour on some day strictly inside the month (never exactly at
  // the 1st's midnight in any zone this product supports), so the offset
  // sampled at each boundary's own naive guess reliably matches the offset
  // actually in effect at that boundary.
  const naiveStartUtc = Date.UTC(year, month - 1, 1);
  const startOffsetMin = offsetMinutesAt(tz, new Date(naiveStartUtc));
  const start = new Date(naiveStartUtc - startOffsetMin * 60_000);

  // `Date.UTC(year, month, 1)` naturally rolls over into January of `year +
  // 1` when `month` is 12 — no explicit year-wrap handling needed.
  const naiveEndUtc = Date.UTC(year, month, 1);
  const endOffsetMin = offsetMinutesAt(tz, new Date(naiveEndUtc));
  const end = new Date(naiveEndUtc - endOffsetMin * 60_000);

  return { start, end };
}
