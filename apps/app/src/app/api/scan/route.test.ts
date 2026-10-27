import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";

const getUserMock = vi.fn();
const sessionDb = { current: makeSupabaseMock({}) };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: sessionDb.current.from,
  }),
}));

const rpcMock = vi.fn();
const adminDb = { current: makeSupabaseMock({}) };
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock, from: adminDb.current.from }),
}));

const getCardMock = vi.fn();
vi.mock("@/lib/cards/queries", async (orig) => ({
  ...(await orig<typeof import("@/lib/cards/queries")>()),
  getCardByBarcode: (...a: unknown[]) => getCardMock(...a),
}));

const notifyMock = vi.fn(async () => undefined);
vi.mock("@/lib/wallet/notify", () => ({ notifyCardUpdated: () => notifyMock() }));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn() }));
vi.mock("@/lib/rewards/queries", () => ({
  getAvailableStandaloneRewardsForCustomer: vi.fn(async () => []),
}));

import { POST } from "./route";

type Over = Record<string, unknown>;
function card(program: Over, over: Over = {}) {
  return {
    id: "card-1",
    business_id: "biz-1",
    customer_id: "cust-1",
    program_id: "prog-1",
    status: "active",
    stamps: 0,
    points: 0,
    rewards: 0,
    points_redeemed: 0,
    uses_count: 0,
    expires_at: null,
    tier: null,
    valid_until: null,
    business: { plan: "small" },
    customer: { full_name: "Ana" },
    program: {
      name: "P",
      goal: 1,
      reward_description: "Offer",
      active: true,
      config: {},
      ...program,
    },
    ...over,
  };
}

const call = async (body: Over) => {
  const res = await POST(
    new Request("http://x/api/scan", {
      method: "POST",
      body: JSON.stringify({ barcode: "stmp_1", ...body }),
    }) as never,
  );
  return { status: res.status, json: await res.json() };
};

/** Pre-mutation card, then the same card reloaded after the RPC. */
function setup(c: ReturnType<typeof card>, mutated: unknown = c) {
  getCardMock.mockResolvedValueOnce(c).mockResolvedValue(mutated);
  rpcMock.mockResolvedValue({ data: mutated, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: { id: "emp-1" } } });
  sessionDb.current = makeSupabaseMock({ stamp_events: { data: null, error: null } });
  adminDb.current = makeSupabaseMock({ stamp_events: { data: { id: "ev-1" }, error: null } });
});

describe("POST /api/scan", () => {
  it("401 without a session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    expect((await call({ action: "lookup" })).status).toBe(401);
  });

  it("lookup is read-only and returns state + program", async () => {
    const c = card({ type: "coupon", config: { max_uses: 3 } });
    getCardMock.mockResolvedValue(c);
    const { status, json } = await call({ action: "lookup" });
    expect(status).toBe(200);
    expect(json.state.actions).toEqual(["use_coupon"]);
    expect(json.program).toMatchObject({ type: "coupon", reward_description: "Offer" });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(sessionDb.current.from).not.toHaveBeenCalled(); // no cooldown query
  });

  it("stamp on a stamp program still works and returns state", async () => {
    const c = card({ type: "stamp", goal: 5 }, { stamps: 1 });
    setup(c);
    const { status, json } = await call({ action: "stamp" });
    expect(status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("apply_stamp", expect.objectContaining({ p_delta: 1 }));
    expect(json.state.type).toBe("stamp");
    expect(json.type).toBe("stamp");
  });

  describe("spend", () => {
    const pts = { type: "points", goal: 100, config: { earn: "spend", points_per_unit: 2 } };

    it("computes delta = floor(amount/100 * rate) and records amount_cents", async () => {
      setup(card(pts));
      const { status } = await call({ action: "spend", amount_cents: 1550 });
      expect(status).toBe(200);
      expect(rpcMock).toHaveBeenCalledWith("apply_stamp", expect.objectContaining({ p_delta: 31 }));
      expect(adminDb.current.builderFor("stamp_events", 1).update).toHaveBeenCalledWith({
        amount_cents: 1550,
      });
    });

    it("rejects an amount worth 0 points, a missing amount, and visit-earn programs", async () => {
      getCardMock.mockResolvedValue(card(pts));
      expect((await call({ action: "spend", amount_cents: 20 })).json.error).toBe("amount_too_small");
      expect((await call({ action: "spend" })).status).toBe(400);
      getCardMock.mockResolvedValue(card({ ...pts, config: { earn: "visit" } }));
      const r = await call({ action: "spend", amount_cents: 1000 });
      expect(r.json.error).toBe("action_not_allowed");
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("applies the stamp cooldown", async () => {
      getCardMock.mockResolvedValue(card(pts));
      sessionDb.current = makeSupabaseMock({
        stamp_events: { data: { created_at: new Date().toISOString(), kind: "stamp" } },
      });
      const r = await call({ action: "spend", amount_cents: 1000 });
      expect(r.status).toBe(429);
    });
  });

  describe("redeem_tier", () => {
    const tiers = [{ points: 50, reward: "Coffee" }, { points: 200, reward: "Meal" }];
    const prog = { type: "points", goal: 50, config: { tiers } };

    it("happy path calls redeem_points_tier with the index", async () => {
      setup(card(prog, { points: 120 }), card(prog, { points: 120, points_redeemed: 50 }));
      const { status, json } = await call({ action: "redeem_tier", tier_index: 0 });
      expect(status).toBe(200);
      expect(rpcMock).toHaveBeenCalledWith(
        "redeem_points_tier",
        expect.objectContaining({ p_tier_index: 0 }),
      );
      expect(json.state.available).toBe(70);
    });

    it("rejects an unaffordable tier, unknown tier and missing index", async () => {
      getCardMock.mockResolvedValue(card(prog, { points: 120 }));
      expect((await call({ action: "redeem_tier", tier_index: 1 })).json.error).toBe("insufficient_points");
      expect((await call({ action: "redeem_tier", tier_index: 9 })).json.error).toBe("tier_not_found");
      expect((await call({ action: "redeem_tier" })).status).toBe(400);
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("maps an RPC insufficient_points exception to 409", async () => {
      getCardMock.mockResolvedValue(card(prog, { points: 120 }));
      rpcMock.mockResolvedValue({ data: null, error: { message: "insufficient_points", code: "P0001" } });
      const r = await call({ action: "redeem_tier", tier_index: 0 });
      expect(r).toMatchObject({ status: 409, json: { error: "insufficient_points" } });
    });
  });

  describe("use_coupon", () => {
    const prog = { type: "coupon", config: { max_uses: 2 } };

    it("happy path", async () => {
      setup(card(prog), card(prog, { uses_count: 1 }));
      const { status, json } = await call({ action: "use_coupon" });
      expect(status).toBe(200);
      expect(rpcMock).toHaveBeenCalledWith("use_coupon", expect.any(Object));
      expect(json.state.usesLeft).toBe(1);
      expect(notifyMock).toHaveBeenCalled();
    });

    it("rejects exhausted and expired coupons without calling the RPC", async () => {
      getCardMock.mockResolvedValue(card(prog, { uses_count: 2 }));
      expect((await call({ action: "use_coupon" })).json.error).toBe("coupon_exhausted");
      getCardMock.mockResolvedValue(card(prog, { expires_at: "2000-01-01T00:00:00Z" }));
      expect((await call({ action: "use_coupon" })).json.error).toBe("coupon_expired");
      expect(rpcMock).not.toHaveBeenCalled();
    });
  });

  describe("membership", () => {
    const future = new Date(Date.now() + 86400000 * 10).toISOString();
    const prog = { type: "membership", config: { access: "staff_activated", renew_days: 30, tiers: [{ name: "Gold", benefits: "x" }] } };

    it("check_in happy path", async () => {
      setup(card(prog, { valid_until: future }));
      const { status } = await call({ action: "check_in" });
      expect(status).toBe(200);
      expect(rpcMock).toHaveBeenCalledWith("membership_check_in", expect.any(Object));
    });

    it("check_in rejected when pending/expired", async () => {
      getCardMock.mockResolvedValue(card(prog));
      const r = await call({ action: "check_in" });
      expect(r).toMatchObject({ status: 409, json: { error: "membership_inactive" } });
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("renew uses config.renew_days and the chosen tier", async () => {
      setup(card(prog), card(prog, { valid_until: future, tier: "Gold" }));
      const { status } = await call({ action: "renew", tier: "Gold" });
      expect(status).toBe(200);
      expect(rpcMock).toHaveBeenCalledWith("renew_membership", {
        p_card_id: "card-1",
        p_days: 30,
        p_tier: "Gold",
      });
    });

    it("renew rejects an unknown tier and a non-membership card", async () => {
      getCardMock.mockResolvedValue(card(prog));
      expect((await call({ action: "renew", tier: "Nope" })).json.error).toBe("tier_not_found");
      getCardMock.mockResolvedValue(card({ type: "stamp", goal: 5 }));
      expect((await call({ action: "renew" })).json.error).toBe("action_not_allowed");
      expect(rpcMock).not.toHaveBeenCalled();
    });
  });

  it("rejects actions on a disabled program and on plan none", async () => {
    getCardMock.mockResolvedValue(card({ type: "coupon", active: false }));
    expect((await call({ action: "use_coupon" })).json.error).toBe("program_disabled");
    getCardMock.mockResolvedValue(card({ type: "coupon" }, { business: { plan: "none" } }));
    expect((await call({ action: "lookup" })).status).toBe(402);
  });

  it("redeem keeps not_redeemable when the card isn't completed", async () => {
    getCardMock.mockResolvedValue(card({ type: "stamp", goal: 5 }));
    expect((await call({ action: "redeem" })).json.error).toBe("not_redeemable");
  });
});
