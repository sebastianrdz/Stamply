import { enrollUrl } from "@/lib/urls";

/** The public invite link for a card; the code is NOT the wallet pass token. */
export function referralLink(programId: string, code: string): string {
  return `${enrollUrl(programId)}?ref=${code}`;
}
