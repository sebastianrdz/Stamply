import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCronAutomations } from "@/lib/automations/cron";

export const runtime = "nodejs";

/**
 * Daily cron for the date-driven automations (birthday reward + message,
 * unredeemed reminder, win back). Welcome and almost-there fire inline from
 * enroll / scan. See lib/automations/cron.ts.
 *
 * HARD REQUIREMENT (org data-handling policy): never log or return any
 * customer name/email/id/phone/birthday/token here — counts only.
 */
export async function GET(req: NextRequest) {
  const secret = requireEnv("CRON_SECRET", "automations cron");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({
      ok: true,
      ...(await runCronAutomations(createAdminClient())),
    });
  } catch (e) {
    console.error("[cron/automations] run failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "run_failed" }, { status: 500 });
  }
}
