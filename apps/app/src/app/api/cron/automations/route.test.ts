import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const afterMock = vi.fn();
vi.mock("next/server", async () => ({
  ...(await vi.importActual<object>("next/server")),
  after: (fn: () => unknown) => afterMock(fn),
}));
vi.mock("@/lib/env", () => ({ requireEnv: () => "secret" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const runAutomations = vi.fn();
vi.mock("@/lib/automations/cron", () => ({
  runCronAutomations: (...a: unknown[]) => runAutomations(...a),
}));
const runMonthly = vi.fn();
vi.mock("@/lib/roi-monthly", () => ({
  runMonthlySummaries: (...a: unknown[]) => runMonthly(...a),
}));

import { GET } from "./route";

const req = (auth?: string, q = "") =>
  new Request(`https://app.test/api/cron/automations${q}`, {
    headers: auth ? { authorization: auth } : {},
  }) as never;

const counts = (over: Record<string, number> = {}) => ({
  checkedAutomations: 2,
  sent: 0,
  skippedAlreadySent: 0,
  granted: 0,
  errors: 0,
  deferred: 0,
  ...over,
});

beforeEach(() => {
  afterMock.mockClear();
  runAutomations.mockReset();
  runMonthly.mockReset();
  runAutomations.mockResolvedValue(counts());
  runMonthly.mockResolvedValue({ sent: 1, skipped: 0, errors: 0 });
});

describe("automations cron", () => {
  it("rejects a missing or wrong secret without running", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(runAutomations).not.toHaveBeenCalled();
  });

  it("runs time-boxed, then the monthly summaries when nothing was deferred", async () => {
    const res = await GET(req("Bearer secret"));
    expect(await res.json()).toMatchObject({
      ok: true,
      deferred: 0,
      monthly: { sent: 1, skipped: 0, errors: 0 },
    });
    expect(runAutomations).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Date),
      {
        budgetMs: 48_000,
      },
    );
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("chains and skips the monthly summaries when work was deferred after real progress", async () => {
    runAutomations.mockResolvedValue(counts({ deferred: 2, sent: 40 }));
    const res = await GET(req("Bearer secret"));
    expect(await res.json()).toMatchObject({ deferred: 2, monthly: null });
    expect(runMonthly).not.toHaveBeenCalled();
    expect(afterMock).toHaveBeenCalledTimes(1);
  });

  it("does not chain when deferred work made no progress (avoids an endless loop)", async () => {
    runAutomations.mockResolvedValue(
      counts({ deferred: 2, sent: 0, granted: 0, skippedAlreadySent: 500 }),
    );
    await GET(req("Bearer secret"));
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("kick mode answers 202 at once and runs in after()", async () => {
    const res = await GET(req("Bearer secret", "?kick=1"));
    expect(res.status).toBe(202);
    expect(runAutomations).not.toHaveBeenCalled();
    await afterMock.mock.calls[0][0]();
    expect(runAutomations).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the run throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    runAutomations.mockRejectedValue(new Error("db down"));
    expect((await GET(req("Bearer secret"))).status).toBe(500);
  });
});
