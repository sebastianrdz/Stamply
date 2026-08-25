import "server-only";

import { Resend } from "resend";
import { requireEnv, serverEnv } from "@/lib/env";

/**
 * Resend client singleton, mirroring the lazy-factory style of
 * `@/lib/supabase/admin`'s `createAdminClient()`: constructed on first use so
 * modules can import this file even before `RESEND_API_KEY` is provisioned,
 * and fails loudly (via `requireEnv`) only once a caller actually tries to
 * send.
 */
let client: Resend | null = null;

export function getResendClient(): Resend {
  if (!client) {
    client = new Resend(requireEnv("RESEND_API_KEY", "transactional email"));
  }
  return client;
}

/**
 * The verified from-address transactional email is sent from, formatted as a
 * `"Display Name <address>"` mailbox for the `from` header. `EMAIL_FROM_ADDRESS`
 * itself holds only the bare address (validated as `z.string().email()` in
 * `@/lib/env` — a `"Name <addr>"` string isn't a valid email per that
 * validator), so the display name is composed here rather than stored in env.
 */
export function emailFromAddress(): string {
  const address =
    serverEnv().EMAIL_FROM_ADDRESS ?? "notifications@mail.stamplycards.com";
  return `Stamply <${address}>`;
}
