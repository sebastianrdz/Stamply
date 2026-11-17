/* eslint-disable @typescript-eslint/no-explicit-any */
// Worker simulation with INJECTED latency. This is a MODEL, not a measurement:
// every latency below is an assumption (override with env vars). Skipped
// unless LOAD=1:  LOAD=1 pnpm vitest run src/lib/wallet/push-worker.load.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const env = (k: string, d: number) => Number(process.env[k] ?? d);
const LAT = {
  googleMessage: env("LAT_GOOGLE_MSG_MS", 250),
  googlePatch: env("LAT_GOOGLE_PATCH_MS", 800),
  apnsBatch: env("LAT_APNS_BATCH_MS", 100),
  db: env("LAT_DB_MS", 5),
};
vi.mock("@/lib/wallet/apple/apns", () => ({
  pushToDevices: async () => wait(LAT.apnsBatch),
}));
vi.mock("@/lib/wallet/google/wallet", () => ({
  addOfferMessage: async () => wait(LAT.googleMessage),
  patchLoyaltyObject: async () => wait(LAT.googlePatch),
}));

import { fakeDb, seed, seedRefresh } from "@/lib/test-utils/wallet-fake";
import { drainOfferDeliveries, drainWalletRefresh } from "./push-worker";

const BUDGET_MS = 48_000; // 80% of the route's 60 s maxDuration
const run = process.env.LOAD === "1" ? describe : describe.skip;

type Row = { kind: string; n: number; conc: number; batch: number } & Awaited<
  ReturnType<typeof simulate>
>;

/** Simulated wall time and chain links (48 s invocations) to finish n items. */
async function simulate(
  kind: "offers" | "refresh",
  n: number,
  conc: number,
  batch: number,
) {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const tables =
    kind === "offers" ? seed(n, { googleEvery: 1 }) : seedRefresh(n, true);
  const db = fakeDb(tables, { delay: () => wait(LAT.db) });
  let links = 0;
  let maxBatchMs = 0;
  for (;;) {
    links++;
    const t0 = Date.now();
    const opts = {
      budgetMs: BUDGET_MS,
      batchSize: batch,
      googleConcurrency: conc,
      sleep: wait,
    };
    const p: Promise<any> =
      kind === "offers"
        ? drainOfferDeliveries(db.client, opts)
        : drainWalletRefresh(db.client, opts);
    let settled = false;
    let result: any;
    p.then((r) => ((result = r), (settled = true)));
    while (!settled) await vi.advanceTimersToNextTimerAsync();
    maxBatchMs = Math.max(maxBatchMs, Date.now() - t0);
    const left = kind === "offers" ? result.remainingOffers : result.remaining;
    if (left === 0 || links > 200) break;
  }
  const seconds = Date.now() / 1000;
  vi.useRealTimers();
  return {
    seconds,
    perSec: n / seconds,
    links,
    batchSeconds:
      ((batch / conc) *
        ((kind === "offers" ? LAT.googleMessage : LAT.googlePatch) + LAT.db)) /
      1000,
  };
}

afterEach(() => vi.useRealTimers());

run("push worker load model (assumed latencies)", () => {
  it("sweeps concurrency and batch size", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const rows: Row[] = [];
    for (const kind of ["offers", "refresh"] as const)
      for (const n of [5_000, 25_000])
        for (const conc of [5, 10, 20, 40])
          for (const batch of [100, 200, 500])
            rows.push({
              kind,
              n,
              conc,
              batch,
              ...(await simulate(kind, n, conc, batch)),
            });
    // eslint-disable-next-line no-console
    console.log(
      `\nMODEL, NOT MEASURED. Assumed latencies (ms): ${JSON.stringify(LAT)}\n` +
        `finish seconds ~= n / conc * (latency + db) ; links = ceil(seconds / ${BUDGET_MS / 1000})\n`,
    );
    // eslint-disable-next-line no-console
    console.table(
      rows.map((r) => ({
        kind: r.kind,
        n: r.n,
        conc: r.conc,
        batch: r.batch,
        "passes/s": Math.round(r.perSec * 10) / 10,
        "finish s": Math.round(r.seconds),
        "48s links": r.links,
        "batch s": Math.round(r.batchSeconds * 10) / 10,
        // The deadline is only checked between batches: 60 s max - 48 s budget.
        "fits 12s": r.batchSeconds <= 12 ? "yes" : "NO",
      })),
    );
    expect(rows.every((r) => r.links < 200)).toBe(true);
  }, 600_000);
});
