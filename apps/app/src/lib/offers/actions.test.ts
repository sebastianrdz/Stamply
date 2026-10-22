import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireRoleMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireRole: (...a: unknown[]) => requireRoleMock(...a),
}));

const rateLimitMock = vi.fn(async () => true);
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...(a as [])),
}));

const notifyOffersMock = vi.fn(async (_s: unknown, offers: unknown[]) => offers.length);
vi.mock("@/lib/wallet/notify", () => ({
  notifyOffers: (s: unknown, o: unknown[]) => notifyOffersMock(s, o),
}));

vi.mock("@stamply/i18n/locale", () => ({ getLocale: async () => "en" }));

// Chainable stand-in for the admin client: customers lookup resolves to
// `eligible`; wallet_offers insert echoes the rows back with ids.
let eligible: { id: string }[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "customers") {
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.eq = () => q;
        q.in = () => q;
        q.then = (res: (v: unknown) => void) =>
          res({ data: eligible, count: eligible.length, error: null });
        return q;
      }
      return {
        insert: (rows: Record<string, unknown>[]) => ({
          select: async () => ({
            data: rows.map((r, i) => ({ id: `o${i}`, ...r })),
            error: null,
          }),
        }),
      };
    },
  }),
}));

import { sendOffer } from "./actions";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function form(body: string, ids: string[] = []) {
  const f = new FormData();
  f.set("body", body);
  ids.forEach((id) => f.append("customerIds", id));
  return f;
}

beforeEach(() => {
  requireRoleMock.mockResolvedValue({
    user: { id: "user-1" },
    membership: { business: { id: "biz-1" } },
  });
  rateLimitMock.mockResolvedValue(true);
  notifyOffersMock.mockClear();
  eligible = [{ id: UUID_A }, { id: UUID_B }];
});

describe("sendOffer", () => {
  it("rejects an empty message", async () => {
    const res = await sendOffer({}, form("   "));
    expect(res.error).toBeTruthy();
    expect(notifyOffersMock).not.toHaveBeenCalled();
  });

  it("rejects a message over 200 characters", async () => {
    const res = await sendOffer({}, form("x".repeat(201)));
    expect(res.error).toBeTruthy();
  });

  it("stops when the daily limit is hit", async () => {
    rateLimitMock.mockResolvedValue(false);
    const res = await sendOffer({}, form("hi"));
    expect(res.error).toBeTruthy();
    expect(notifyOffersMock).not.toHaveBeenCalled();
  });

  it("rejects when a selected customer is not opted in / not in the business", async () => {
    eligible = [{ id: UUID_A }]; // asked for A and B, only A is eligible
    const res = await sendOffer({}, form("hi", [UUID_A, UUID_B]));
    expect(res.error).toBeTruthy();
    expect(notifyOffersMock).not.toHaveBeenCalled();
  });

  it("sends a single broadcast offer when no customers are selected", async () => {
    const res = await sendOffer({}, form("2x1 coffee"));
    expect(res).toEqual({ sent: 1 });
    const offers = notifyOffersMock.mock.calls[0][1] as { customer_id: unknown }[];
    expect(offers).toHaveLength(1);
    expect(offers[0].customer_id).toBeNull();
  });

  it("sends one offer per selected customer", async () => {
    const res = await sendOffer({}, form("2x1 coffee", [UUID_A, UUID_B]));
    expect(res).toEqual({ sent: 2 });
  });

  it("errors when nobody has opted in", async () => {
    eligible = [];
    const res = await sendOffer({}, form("hi"));
    expect(res.error).toBeTruthy();
  });
});
