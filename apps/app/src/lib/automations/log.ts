/** Loggable error info; PostgrestError is a plain object, not an Error. No PII. */
export function errInfo(e: unknown): { code?: string; message: string } {
  if (e && typeof e === "object") {
    const o = e as { code?: unknown; message?: unknown };
    return {
      ...(typeof o.code === "string" && { code: o.code }),
      message: typeof o.message === "string" ? o.message : "unknown",
    };
  }
  return { message: String(e) };
}
