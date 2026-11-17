import { NextResponse, after, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCronAutomations } from "@/lib/automations/cron";
import { runMonthlySummaries } from "@/lib/roi-monthly";
import { appUrl } from "@/lib/urls";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily cron for the date-driven automations (birthday reward + message,
 * unredeemed reminder, win back). Welcome and almost-there fire inline from
 * enroll / scan. See lib/automations/cron.ts. Also sends the owners' monthly
 * ROI summary on the first days of a month (lib/roi-monthly.ts).
 *
 * Time-boxed to ~80% of maxDuration. When automations are deferred it chains
 * itself (fast-ack `?kick=1`, like the wallet push route) as long as the run
 * made real progress; the daily schedule picks up the rest otherwise. The
 * monthly summaries run only on a run that finished everything.
 *
 * HARD REQUIREMENT (org data-handling policy): never log or return any
 * customer name/email/id/phone/birthday/token here — counts only.
 */
export async function GET(req: NextRequest) {
  const secret = requireEnv("CRON_SECRET", "automations cron");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const kick = new URL(req.url).searchParams.get("kick") === "1";
  const run = async () => {
    const admin = createAdminClient();
    const automations = await runCronAutomations(admin, new Date(), {
      budgetMs: maxDuration * 0.8 * 1000,
    });
    if (automations.deferred > 0) {
      // Chain only when something new was sent or granted, otherwise the same
      // already-sent customers would be re-checked forever.
      if (automations.sent > 0 || automations.granted > 0) {
        after(async () => {
          await fetch(`${appUrl()}/api/cron/automations?kick=1`, {
            headers: { authorization: `Bearer ${secret}` },
          }).catch((e) =>
            console.error("[cron/automations] chain failed", {
              error: e instanceof Error ? e.message : String(e),
            }),
          );
        });
      }
      return { ...automations, monthly: null };
    }
    // Isolated: a monthly-email failure must not fail the automations run.
    const monthly = await runMonthlySummaries(admin).catch((e) => {
      console.error("[cron/monthly] run failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return { sent: 0, skipped: 0, errors: 1 };
    });
    return { ...automations, monthly };
  };
  if (kick) {
    after(() =>
      run().catch((e) =>
        console.error("[cron/automations] run failed", {
          error: e instanceof Error ? e.message : String(e),
        }),
      ),
    );
    return NextResponse.json({ ok: true, queued: true }, { status: 202 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await run()) });
  } catch (e) {
    console.error("[cron/automations] run failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "run_failed" }, { status: 500 });
  }
}
