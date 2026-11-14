import { appUrl } from "@/lib/urls";

// Where Google hands owners their review link (Business Profile "Get more
// reviews", Maps share links). Exact host or any subdomain.
const GOOGLE_HOSTS = ["google.com", "g.page", "goo.gl", "g.co", "share.google"];

/** An https Google review link: no credentials, host on the allow-list. */
export function isReviewUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  return GOOGLE_HOSTS.some(
    (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
  );
}

/** Our tracked link for a card; /r/[token] logs the click, then redirects. */
export function reviewLink(token: string, source?: "card"): string {
  return `${appUrl()}/r/${token}${source ? `?s=${source}` : ""}`;
}
