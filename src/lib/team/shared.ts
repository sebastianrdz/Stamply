/** True if an invitation's expiry is in the past. Kept out of the "use server"
 *  actions module so it can be imported by both server components and actions. */
export function isInviteExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}
