/** IANA zones the runtime knows, with UTC first (not always in the list). */
export function timezoneOptions(current?: string): string[] {
  const all = Intl.supportedValuesOf("timeZone");
  const set = new Set(["UTC", ...all]);
  if (current) set.add(current);
  return [...set];
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
