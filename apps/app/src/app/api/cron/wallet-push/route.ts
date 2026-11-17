import { NextResponse, after, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";
import { kickWalletPush } from "@/lib/wallet/kick";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  drainOfferDeliveries,
  drainWalletRefresh,
} from "@/lib/wallet/push-worker";

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
  const kick = new URL(req.url).searchParams.get("kick") === "1";
  const run = async () => {
    const admin = createAdminClient();
    const budget = maxDuration * 0.8 * 1000;
    const start = Date.now();
    const offers = await drainOfferDeliveries(admin, { budgetMs: budget });
    // One wall-clock budget shared by both drains.
    const refresh = await drainWalletRefresh(admin, {
      budgetMs: Math.max(0, budget - (Date.now() - start)),
    });
    const result = {
      ...offers,
      refreshed: refresh.refreshed,
      refreshFailed: refresh.failed,
      remainingRefresh: refresh.remaining,
    };
    const progress =
      offers.delivered + offers.failed + refresh.refreshed + refresh.failed > 0;
    if (progress && (offers.remainingOffers > 0 || refresh.remaining > 0))
      kickWalletPush();
    return result;
  };
  if (kick) {
    after(() =>
      run().catch((e) =>
        console.error("[cron/wallet-push] run failed", {
          error: e instanceof Error ? e.message : String(e),
        }),
      ),
    );
    return NextResponse.json({ ok: true, queued: true }, { status: 202 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await run()) });
  } catch (e) {
    console.error("[cron/wallet-push] run failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "run_failed" }, { status: 500 });
  }
}
