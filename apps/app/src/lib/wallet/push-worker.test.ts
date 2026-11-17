/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const pushToDevices = vi.fn(async (...args: [string[]]) => void args);
const patchLoyaltyObject = vi.fn(async (...args: [unknown]) => void args);
const addOfferMessage = vi.fn(async (...args: [string, unknown]) => void args);
vi.mock("@/lib/wallet/apple/apns", () => ({
  pushToDevices: (t: string[]) => pushToDevices(t),
}));
vi.mock("@/lib/wallet/google/wallet", () => ({
  addOfferMessage: (c: string, o: unknown) => addOfferMessage(c, o),
  patchLoyaltyObject: (c: unknown) => patchLoyaltyObject(c),
}));

import { fakeDb, seed, seedRefresh } from "@/lib/test-utils/wallet-fake";
import { drainOfferDeliveries, drainWalletRefresh } from "./push-worker";

const noSleep = async () => {};

beforeEach(() => {
  pushToDevices.mockClear();
  addOfferMessage.mockReset();
  addOfferMessage.mockResolvedValue(undefined);
});

describe("drainOfferDeliveries", () => {
  it("delivers every recipient exactly once across several runs (>1,000)", async () => {
    const db = fakeDb(seed(1250));
    const seen: string[] = [];
    pushToDevices.mockImplementation(async (t) => void seen.push(...t));
    // Tiny budget per run is simulated by many small batches over multiple runs.
    let delivered = 0;
    for (let run = 0; run < 3; run++) {
      const r = await drainOfferDeliveries(db.client, {
        budgetMs: 60_000,
        batchSize: 200,
        sleep: noSleep,
      });
      delivered += r.delivered;
    }
    expect(delivered).toBe(1250);
    expect(new Set(seen).size).toBe(1250);
    expect(seen).toHaveLength(1250);
    expect(db.tables.wallet_offers[0].delivery).toBe("done");
    expect(db.tables.cards.every((c) => c.updated_at)).toBe(true);
  });

  it("leaves a failing recipient undelivered and stops claiming it after 3 attempts", async () => {
    const db = fakeDb(seed(3, { googleEvery: 1 }));
    addOfferMessage.mockImplementation(async (c) => {
      if (c === "card-c00001") throw { response: { status: 500 } };
    });
    const expire = () =>
      db.tables.wallet_offer_recipients.forEach(
        (r) => (r.claimed_until = null),
      );
    for (let i = 0; i < 4; i++) {
      await drainOfferDeliveries(db.client, {
        budgetMs: 60_000,
        sleep: noSleep,
      });
      expire();
    }
    const bad = db.tables.wallet_offer_recipients.find(
      (r) => r.customer_id === "c00001",
    )!;
    expect(bad.delivered_at).toBeNull();
    expect(bad.attempts).toBe(3);
    expect(bad.last_error).toBe("google error 500");
    expect(
      addOfferMessage.mock.calls.filter((c) => c[0] === "card-c00001"),
    ).toHaveLength(3);
    expect(db.tables.wallet_offers[0].delivery).toBe("done");
  });

  it("batches Apple tokens and bounds Google concurrency, retrying 429", async () => {
    const db = fakeDb(seed(50, { googleEvery: 1 }));
    let inflight = 0;
    let peak = 0;
    let first = true;
    addOfferMessage.mockImplementation(async () => {
      inflight++;
      peak = Math.max(peak, inflight);
      await new Promise((r) => setTimeout(r, 2));
      inflight--;
      if (first) {
        first = false;
        throw { response: { status: 429, headers: { "retry-after": "1" } } };
      }
    });
    const sleep = vi.fn(noSleep);
    const r = await drainOfferDeliveries(db.client, {
      budgetMs: 60_000,
      batchSize: 20,
      googleConcurrency: 4,
      sleep,
    });
    expect(r).toMatchObject({ delivered: 50, failed: 0, remainingOffers: 0 });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
    expect(pushToDevices).toHaveBeenCalledTimes(3);
    expect(Math.max(...pushToDevices.mock.calls.map((c) => c[0].length))).toBe(
      20,
    );
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(addOfferMessage).toHaveBeenCalledTimes(51);
  });

  it("keeps delivering to Google when the Apple push throws", async () => {
    const db = fakeDb(seed(5, { googleEvery: 1 }));
    pushToDevices.mockRejectedValueOnce({ code: "NoCredentials" });
    const r = await drainOfferDeliveries(db.client, {
      budgetMs: 60_000,
      sleep: noSleep,
    });
    expect(r).toMatchObject({ delivered: 5, failed: 0 });
    expect(addOfferMessage).toHaveBeenCalledTimes(5);
    const recs = db.tables.wallet_offer_recipients;
    expect(recs.every((x) => x.delivered_at && !x.last_error)).toBe(true);
  });

  it("returns cleanly with work remaining when the budget is spent", async () => {
    const db = fakeDb(seed(10));
    const r = await drainOfferDeliveries(db.client, { budgetMs: 0 });
    expect(r).toEqual({ delivered: 0, failed: 0, remainingOffers: 1 });
    expect(db.rpcs.claim).toBe(0);
  });

  it("never touches offers already done and counts card-less recipients as delivered", async () => {
    const s = seed(2);
    s.cards = [];
    s.wallet_offer_recipients.push({
      offer_id: "done",
      customer_id: "x",
      delivered_at: null,
      attempts: 0,
      claimed_until: null,
      last_error: null,
    });
    const db = fakeDb(s);
    const r = await drainOfferDeliveries(db.client, {
      budgetMs: 60_000,
      sleep: noSleep,
    });
    expect(r.delivered).toBe(2);
    expect(pushToDevices).not.toHaveBeenCalled();
    const x = s.wallet_offer_recipients.find((q) => q.offer_id === "done")!;
    expect(x.attempts).toBe(0);
    expect(x.delivered_at).toBeNull();
  });
});

describe("drainWalletRefresh", () => {
  beforeEach(() => {
    patchLoyaltyObject.mockReset();
    patchLoyaltyObject.mockResolvedValue(undefined);
  });

  it("refreshes every queued card exactly once across runs (>1,000)", async () => {
    const db = fakeDb(seedRefresh(1250, true));
    const patched: string[] = [];
    patchLoyaltyObject.mockImplementation(
      async (c: any) => void patched.push(c.id),
    );
    let refreshed = 0;
    for (let run = 0; run < 3; run++) {
      const r = await drainWalletRefresh(db.client, {
        budgetMs: 60_000,
        sleep: noSleep,
      });
      refreshed += r.refreshed;
      expect(r.remaining).toBe(0);
    }
    expect(refreshed).toBe(1250);
    expect(patched).toHaveLength(1250);
    expect(new Set(patched).size).toBe(1250);
    expect(db.tables.wallet_refresh_queue).toHaveLength(0);
  });

  it("bounds Apple batches and keeps patching Google when Apple throws", async () => {
    const db = fakeDb(seedRefresh(120, true));
    pushToDevices.mockRejectedValueOnce({ code: "NoCredentials" });
    const r = await drainWalletRefresh(db.client, {
      budgetMs: 60_000,
      batchSize: 50,
      sleep: noSleep,
    });
    expect(r).toEqual({ refreshed: 120, failed: 0, remaining: 0 });
    expect(pushToDevices).toHaveBeenCalledTimes(3);
    expect(Math.max(...pushToDevices.mock.calls.map((c) => c[0].length))).toBe(
      50,
    );
    expect(patchLoyaltyObject).toHaveBeenCalledTimes(120);
  });

  it("keeps a failing row with last_error and stops claiming it after 3 attempts", async () => {
    const db = fakeDb(seedRefresh(3, true));
    patchLoyaltyObject.mockImplementation(async (c: any) => {
      if (c.id === "card-c00001") throw { response: { status: 500 } };
    });
    for (let i = 0; i < 4; i++) {
      await drainWalletRefresh(db.client, { budgetMs: 60_000, sleep: noSleep });
      db.tables.wallet_refresh_queue.forEach((r) => (r.claimed_until = null));
    }
    expect(db.tables.wallet_refresh_queue).toEqual([
      {
        card_id: "card-c00001",
        attempts: 3,
        claimed_until: null,
        last_error: "google error 500",
      },
    ]);
    expect(
      patchLoyaltyObject.mock.calls.filter(
        (c: any) => c[0].id === "card-c00001",
      ),
    ).toHaveLength(3);
  });

  it("retries a 429 with retry-after", async () => {
    const db = fakeDb(seedRefresh(1, true));
    patchLoyaltyObject.mockRejectedValueOnce({
      response: { status: 429, headers: { "retry-after": "2" } },
    });
    const sleep = vi.fn(noSleep);
    const r = await drainWalletRefresh(db.client, { budgetMs: 60_000, sleep });
    expect(r.refreshed).toBe(1);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(patchLoyaltyObject).toHaveBeenCalledTimes(2);
  });

  it("returns cleanly with rows remaining when the budget is spent", async () => {
    const db = fakeDb(seedRefresh(10));
    const r = await drainWalletRefresh(db.client, { budgetMs: 0 });
    expect(r).toEqual({ refreshed: 0, failed: 0, remaining: 10 });
  });
});

describe("batch log line", () => {
  it("logs one counts-and-ms line per batch with no identifiers", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const db = fakeDb(seed(5, { googleEvery: 1 }));
    await drainOfferDeliveries(db.client, { budgetMs: 60_000, batchSize: 2 });
    const rdb = fakeDb(seedRefresh(3, true));
    await drainWalletRefresh(rdb.client, { budgetMs: 60_000, batchSize: 2 });
    const lines = info.mock.calls.map((c) => String(c[0]));
    info.mockRestore();
    expect(lines).toHaveLength(5); // 3 offer batches (2+2+1) + 2 refresh batches
    for (const l of lines) {
      const o = JSON.parse(l);
      expect(Object.keys(o).sort()).toEqual(
        ["batch", "delivered", "failed", "ms", "size"].sort(),
      );
      expect(l).not.toMatch(/c0000|card-|o1|push-|t-c/);
    }
    expect(JSON.parse(lines[0])).toMatchObject({
      batch: "offers",
      size: 2,
      delivered: 2,
      failed: 0,
    });
    expect(JSON.parse(lines[4])).toMatchObject({ batch: "refresh", size: 1 });
  });
});
