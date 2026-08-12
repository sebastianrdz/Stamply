import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireEnv, serverEnv } from "@/lib/env";

/**
 * Service-role client — BYPASSES RLS. Use ONLY in trusted server code for
 * operations that legitimately cross the session boundary: customer enrollment,
 * wallet callbacks (Apple/Google), Stripe webhooks, and atomic stamp RPCs.
 * Never import this into client code.
 */
export function createAdminClient() {
  const env = serverEnv();
  const serviceKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "privileged server operations",
  );
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
