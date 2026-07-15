import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { serverEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads/writes the auth session cookie and enforces RLS as the signed-in user.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = serverEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Called from a Server Component render (read-only cookies) will throw;
          // that's safe to ignore when middleware refreshes the session.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* no-op: session refresh handled by middleware */
          }
        },
      },
    },
  );
}
