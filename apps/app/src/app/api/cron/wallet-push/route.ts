import { NextResponse, after, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";
import { appUrl } from "@/lib/urls";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainOfferDeliveries } from "@/lib/wallet/push-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Delivers queued broadcast offers (see lib/wallet/push-worker.ts). When the
 * time budget ends with work left it re-invokes itself once, so delivery
 * chains until the backlog is empty; a run that delivered and failed nothing
 * never chains. The daily cron is the safety net if a chain link is lost.
 *
 * Counts only: never log or return customer data.
 */
export async function GET(req: NextRequest) {
  const secret = requireEnv("CRON_SECRET", "wallet push cron");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await drainOfferDeliveries(createAdminClient(), {
      budgetMs: maxDuration * 0.8 * 1000,
    });
    if (
      result.remainingOffers > 0 &&
      (result.delivered > 0 || result.failed > 0)
    ) {
      after(async () => {
        await fetch(`${appUrl()}/api/cron/wallet-push`, {
          headers: { authorization: `Bearer ${secret}` },
        }).catch((e) =>
          console.error("[cron/wallet-push] chain failed", {
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/wallet-push] run failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "run_failed" }, { status: 500 });
  }
}
