import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const afterMock = vi.fn();
vi.mock("next/server", async () => ({
  ...(await vi.importActual<object>("next/server")),
  after: (fn: () => unknown) => afterMock(fn),
}));
vi.mock("@/lib/env", () => ({ requireEnv: () => "secret" }));
vi.mock("@/lib/urls", () => ({ appUrl: () => "https://app.test" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const drain = vi.fn();
vi.mock("@/lib/wallet/push-worker", () => ({
  drainOfferDeliveries: (...a: unknown[]) => drain(...a),
}));

import { GET } from "./route";

const req = (auth?: string, q = "") =>
  new Request(`https://app.test/api/cron/wallet-push${q}`, {
    headers: auth ? { authorization: auth } : {},
  }) as never;

beforeEach(() => {
  afterMock.mockClear();
  drain.mockReset();
});

describe("wallet-push cron", () => {
  it("rejects a missing or wrong secret without draining", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(drain).not.toHaveBeenCalled();
  });

  it("chains once when work remains and progress was made", async () => {
    drain.mockResolvedValue({ delivered: 5, failed: 0, remainingOffers: 1 });
    const res = await GET(req("Bearer secret"));
    expect(await res.json()).toEqual({
      ok: true,
      delivered: 5,
      failed: 0,
      remainingOffers: 1,
    });
    expect(afterMock).toHaveBeenCalledTimes(1);
  });

  it("does not chain when nothing made progress or nothing remains", async () => {
    drain.mockResolvedValue({ delivered: 0, failed: 0, remainingOffers: 1 });
    await GET(req("Bearer secret"));
    drain.mockResolvedValue({ delivered: 9, failed: 0, remainingOffers: 0 });
    await GET(req("Bearer secret"));
    expect(afterMock).not.toHaveBeenCalled();
  });

  describe("kick=1", () => {
    it("rejects a wrong secret", async () => {
      expect((await GET(req("Bearer nope", "?kick=1"))).status).toBe(401);
      expect(drain).not.toHaveBeenCalled();
    });

    it("acks 202 without awaiting the drain, which runs in after()", async () => {
      drain.mockResolvedValue({ delivered: 5, failed: 0, remainingOffers: 1 });
      const res = await GET(req("Bearer secret", "?kick=1"));
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ ok: true, queued: true });
      expect(drain).not.toHaveBeenCalled();
      expect(afterMock).toHaveBeenCalledTimes(1);

      const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
      vi.stubGlobal("fetch", fetchMock);
      await afterMock.mock.calls[0][0]();
      expect(drain).toHaveBeenCalledTimes(1);
      // The chain is itself scheduled via after(); run it.
      expect(afterMock).toHaveBeenCalledTimes(2);
      await afterMock.mock.calls[1][0]();
      vi.unstubAllGlobals();
      expect(fetchMock).toHaveBeenCalledWith(
        "https://app.test/api/cron/wallet-push?kick=1",
        { headers: { authorization: "Bearer secret" } },
      );
    });

    it("does not chain when no progress was made", async () => {
      drain.mockResolvedValue({ delivered: 0, failed: 0, remainingOffers: 1 });
      await GET(req("Bearer secret", "?kick=1"));
      await afterMock.mock.calls[0][0]();
      expect(afterMock).toHaveBeenCalledTimes(1);
    });
  });
});
