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

const req = (auth?: string) =>
  new Request("https://app.test/api/cron/wallet-push", {
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
});
