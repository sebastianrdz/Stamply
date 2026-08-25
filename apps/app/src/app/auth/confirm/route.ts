import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for every emailed auth link (signup confirmation, password
 * reset) built by `@/lib/auth/actions`. Uses the SSR server client (not the
 * admin client) so `verifyOtp` writes the session cookie via the existing
 * cookie adapter in `@/lib/supabase/server` — the admin client never touches
 * cookies and would leave the browser signed out.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=invalid_link");
}
