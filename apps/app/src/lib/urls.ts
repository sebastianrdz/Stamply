/** Absolute URL helpers. Safe to use on server and client. */
function base(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

/** Absolute base URL of this app itself. Used to build links this app owns
 *  (e.g. the `/auth/confirm` link embedded in transactional email). */
export function appUrl(): string {
  return base();
}

/** Absolute base URL of the marketing site (apex domain). Used for links that
 *  leave the app subdomain and go back to the public marketing home. */
export function marketingUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MARKETING_URL?.replace(/\/$/, "") ??
    "http://localhost:3001"
  );
}

/** Terms & Conditions page, hosted on the marketing site. */
export function termsUrl(): string {
  return `${marketingUrl()}/terms`;
}

/** Privacy Policy page, hosted on the marketing site. */
export function privacyUrl(): string {
  return `${marketingUrl()}/privacy`;
}

/** Public enrollment link for a program (shown as an in-store QR). */
export function enrollUrl(programId: string): string {
  return `${base()}/c/join/${programId}`;
}

/** Public web view of a single loyalty card. */
export function cardUrl(token: string): string {
  return `${base()}/c/${token}`;
}

/** Team-invite accept link, shared via the copy-link UI and email. */
export function joinUrl(token: string): string {
  return `${base()}/join/${token}`;
}
