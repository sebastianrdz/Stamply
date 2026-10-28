const DAY_MS = 86_400_000;

export function tzOrUtc(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

/** Wall-clock `YYYY-MM-DD` of `instant` in `timezone`. */
export function localDate(timezone: string, instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tzOrUtc(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * Birthday message due today? `day` on the birthday itself, `pre` exactly
 * `daysBefore` days earlier. Feb 29 birthdays fall on Feb 28 in common years.
 */
export function birthdayTrigger(
  birthday: string | null,
  timezone: string,
  now: Date,
  daysBefore: number,
): { periodKey: string; days: number } | null {
  if (!birthday) return null;
  const today = localDate(timezone, now);
  const matches = (ymd: string) => {
    let md = birthday.slice(5);
    if (md === "02-29" && !isLeap(Number(ymd.slice(0, 4)))) md = "02-28";
    return ymd.slice(5) === md;
  };
  if (matches(today)) return { periodKey: `${today.slice(0, 4)}-day`, days: 0 };
  if (daysBefore > 0) {
    const target = addDays(today, daysBefore);
    if (matches(target)) {
      return { periodKey: `${target.slice(0, 4)}-pre`, days: daysBefore };
    }
  }
  return null;
}

/** Start date of the current `everyDays`-long bucket (stable across runs). */
export function reminderBucketKey(
  timezone: string,
  now: Date,
  everyDays: number,
): string {
  const today = localDate(timezone, now);
  const [y, m, d] = today.split("-").map(Number);
  const epochDays = Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
  return addDays(today, -(epochDays % Math.max(1, everyDays)));
}

/** Last-visit date when the lapse is long enough, else null (one nudge per lapse). */
export function winBackKey(
  lastVisit: Date,
  inactiveDays: number,
  timezone: string,
  now: Date,
): string | null {
  if (now.getTime() - lastVisit.getTime() < inactiveDays * DAY_MS) return null;
  return localDate(timezone, lastVisit);
}

/** Stamps left to the next reward, and which reward cycle the card is in. */
export function almostThere(
  stamps: number,
  goal: number,
  remaining: number,
): { left: number; cycle: number } | null {
  if (goal <= 0) return null;
  const left = goal - (stamps % goal);
  return left < goal && left <= remaining
    ? { left, cycle: Math.floor(stamps / goal) }
    : null;
}
