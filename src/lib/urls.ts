/** Absolute URL helpers. Safe to use on server and client. */
function base(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

/** Public enrollment link for a program (shown as an in-store QR). */
export function enrollUrl(programId: string): string {
  return `${base()}/c/join/${programId}`;
}

/** Public web view of a single loyalty card. */
export function cardUrl(token: string): string {
  return `${base()}/c/${token}`;
}
