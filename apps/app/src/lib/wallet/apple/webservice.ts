import "server-only";

/** Extract the pass authentication token from an "Authorization: ApplePass <t>" header. */
export function passTokenFromAuth(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^ApplePass\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
