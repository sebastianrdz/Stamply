import "server-only";

import { after } from "next/server";
import { requireEnv } from "@/lib/env";
import { appUrl } from "@/lib/urls";

/**
 * Start the wallet push worker after the response: fast-ack fetch to the cron
 * route (it drains in its own after() and chains while work remains). The
 * secret stays server-side. A failed kick is only logged; the daily cron is
 * the safety net.
 */
export function kickWalletPush(): void {
  after(() =>
    fetch(`${appUrl()}/api/cron/wallet-push?kick=1`, {
      headers: {
        authorization: `Bearer ${requireEnv("CRON_SECRET", "wallet push")}`,
      },
    }).catch((e) =>
      console.error("[wallet-kick] failed", {
        error: e instanceof Error ? e.message : String(e),
      }),
    ),
  );
}
