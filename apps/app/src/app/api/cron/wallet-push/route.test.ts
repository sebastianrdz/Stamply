import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const afterMock = vi.fn();
vi.mock("next/server", async () => ({
  ...(await vi.importActual<object>("next/server")),
  after: (fn: () => unknown) => afterMock(fn),
}));
vi.mock("@/lib/env", () => ({ requireEnv: () => "secret" }));
const kickMock = vi.fn();
vi.mock("@/lib/wallet/kick", () => ({ kickWalletPush: () => kickMock() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const drain = vi.fn();
const refresh = vi.fn();
vi.mock("@/lib/wallet/push-worker", () => ({
  drainOfferDeliveries: (...a: unknown[]) => drain(...a),
  drainWalletRefresh: (...a: unknown[]) => refresh(...a),
}));

import { GET } from "./route";

const req = (auth?: string, q = "") =>
  new Request(`https://app.test/api/cron/wallet-push${q}`, {
    headers: auth ? { authorization: auth } : {},
  }) as never;

const offers = (delivered: number, failed: number, remainingOffers: number) =>
  drain.mockResolvedValue({ delivered, failed, remainingOffers });
const refr = (refreshed: number, failed: number, remaining: number) =>
  refresh.mockResolvedValue({ refreshed, failed, remaining });

beforeEach(() => {
  afterMock.mockClear();
  kickMock.mockClear();
  drain.mockReset();
  refresh.mockReset();
  offers(0, 0, 0);
  refr(0, 0, 0);
});

describe("wallet-push cron", () => {
  it("rejects a missing or wrong secret without draining", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(drain).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("drains offers then refresh, returns both counts, shares one budget", async () => {
    offers(5, 0, 0);
    refr(7, 1, 0);
    const res = await GET(req("Bearer secret"));
    expect(await res.json()).toEqual({
      ok: true,
      delivered: 5,
      failed: 0,
      remainingOffers: 0,
      refreshed: 7,
      refreshFailed: 1,
      remainingRefresh: 0,
    });
    const offerBudget = drain.mock.calls[0][1].budgetMs;
    expect(refresh.mock.calls[0][1].budgetMs).toBeLessThanOrEqual(offerBudget);
    expect(kickMock).not.toHaveBeenCalled();
  });

  it("chains when offers remain and progress was made", async () => {
    offers(5, 0, 1);
    await GET(req("Bearer secret"));
    expect(kickMock).toHaveBeenCalledTimes(1);
  });

  it("chains when only refresh rows remain and refresh progressed", async () => {
    refr(40, 0, 900);
    await GET(req("Bearer secret"));
    expect(kickMock).toHaveBeenCalledTimes(1);
  });

  it("does not chain without progress, or when nothing remains", async () => {
    offers(0, 0, 1);
    refr(0, 0, 5);
    await GET(req("Bearer secret"));
    offers(9, 0, 0);
    refr(3, 0, 0);
    await GET(req("Bearer secret"));
    expect(kickMock).not.toHaveBeenCalled();
  });

  describe("kick=1", () => {
    it("rejects a wrong secret", async () => {
      expect((await GET(req("Bearer nope", "?kick=1"))).status).toBe(401);
      expect(drain).not.toHaveBeenCalled();
    });

    it("acks 202 without awaiting the drains, which run in after()", async () => {
      offers(5, 0, 1);
      const res = await GET(req("Bearer secret", "?kick=1"));
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ ok: true, queued: true });
      expect(drain).not.toHaveBeenCalled();
      expect(afterMock).toHaveBeenCalledTimes(1);
      await afterMock.mock.calls[0][0]();
      expect(drain).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(kickMock).toHaveBeenCalledTimes(1);
    });

    it("does not chain when no progress was made", async () => {
      offers(0, 0, 1);
      await GET(req("Bearer secret", "?kick=1"));
      await afterMock.mock.calls[0][0]();
      expect(kickMock).not.toHaveBeenCalled();
    });
  });
});
