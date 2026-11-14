import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCronAutomations } from "@/lib/automations/cron";
import { runMonthlySummaries } from "@/lib/roi-monthly";

export const runtime = "nodejs";

/**
 * Daily cron for the date-driven automations (birthday reward + message,
 * unredeemed reminder, win back). Welcome and almost-there fire inline from
 * enroll / scan. See lib/automations/cron.ts. Also sends the owners' monthly
 * ROI summary on the first days of a month (lib/roi-monthly.ts).
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
    const admin = createAdminClient();
    const automations = await runCronAutomations(admin);
    // Isolated: a monthly-email failure must not fail the automations run.
    const monthly = await runMonthlySummaries(admin).catch((e) => {
      console.error("[cron/monthly] run failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return { sent: 0, skipped: 0, errors: 1 };
    });
    return NextResponse.json({ ok: true, ...automations, monthly });
  } catch (e) {
    console.error("[cron/automations] run failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "run_failed" }, { status: 500 });
  }
}
