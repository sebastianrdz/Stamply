/** Absolute URL helpers. Safe to use on server and client. */
function base(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

/** Absolute base URL of the marketing site (apex domain). Used for links that
 *  leave the app subdomain and go back to the public marketing home. */
export function marketingUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MARKETING_URL?.replace(/\/$/, "") ??
    "http://localhost:3001"
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
