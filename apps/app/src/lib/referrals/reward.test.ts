import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";

const notifyMock = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/lib/wallet/notify", () => ({
  notifyCardUpdated: (...a: unknown[]) => notifyMock(...a),
}));
const sendOffersMock = vi.fn();
vi.mock("@/lib/offers/send", () => ({
  sendWalletOffers: (...a: unknown[]) => sendOffersMock(...a),
}));
const getCardByIdMock = vi.fn();
vi.mock("@/lib/cards/queries", () => ({
  getCardById: (...a: unknown[]) => getCardByIdMock(...a),
}));

import { triggerReferralReward } from "./reward";

const ON = {
  referral: {
    enabled: true,
    referrer_bonus: 2,
    referred_bonus: 1,
    monthly_cap: 4,
  },
};
const card = (config: Record<string, unknown> | null = ON, type = "stamp") =>
  ({
    id: "card-2",
    business: { timezone: "America/Mexico_City" },
    program: { type, config },
  }) as never;

function setup(
  pending: unknown,
  rpcResult: { data?: unknown; error?: unknown } = {},
) {
  const db = makeSupabaseMock({ referrals: { data: pending, error: null } });
  const rpc = vi.fn(async () => ({ data: null, error: null, ...rpcResult }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db, rpc, admin: { from: db.from, rpc } as any };
}
const paid = (referrer_paid: boolean) => ({
  data: [
    {
      referrer_card_id: "card-1",
      referred_card_id: "card-2",
      referrer_paid,
      friend_paid: true,
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  getCardByIdMock.mockResolvedValue({
    id: "card-1",
    business_id: "biz-1",
    customer_id: "cust-1",
    business: { name: "Cafe", locale: null },
    program: { type: "stamp" },
  });
  sendOffersMock.mockResolvedValue({ ok: true, sent: 1 });
});

describe("triggerReferralReward", () => {
  it("pays with the program's bonuses and cap, then messages the referrer", async () => {
    const { admin, rpc, db } = setup({ id: "ref-1" }, paid(true));
    await triggerReferralReward(admin, card());
    expect(db.builderFor("referrals").eq).toHaveBeenCalledWith(
      "referred_card_id",
      "card-2",
    );
    expect(rpc).toHaveBeenCalledWith("pay_referral", {
      p_referral_id: "ref-1",
      p_referrer_bonus: 2,
      p_friend_bonus: 1,
      p_monthly_cap: 4,
      p_tz: "America/Mexico_City",
    });
    expect(getCardByIdMock).toHaveBeenCalledWith(admin, "card-1");
    // Spanish by default; a system message, not an owner broadcast.
    expect(sendOffersMock).toHaveBeenCalledWith(admin, {
      businessId: "biz-1",
      customerIds: ["cust-1"],
      kind: "referral",
      body: "¡Tu amigo se unió a Cafe! Ganaste 2 sellos.",
    });
    expect(notifyMock).not.toHaveBeenCalled(); // the message already refreshes the pass
  });

  it("writes the message in English and in points when the business and program say so", async () => {
    getCardByIdMock.mockResolvedValue({
      id: "card-1",
      business_id: "biz-1",
      customer_id: "cust-1",
      business: { name: "Cafe", locale: "en" },
      program: { type: "points" },
    });
    const { admin } = setup({ id: "ref-1" }, paid(true));
    await triggerReferralReward(admin, card(ON, "points"));
    expect(sendOffersMock).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        body: "Your friend joined Cafe! You earned 2 points.",
      }),
    );
  });

  it("still refreshes the pass silently when the referrer can't be messaged (no marketing consent)", async () => {
    sendOffersMock.mockResolvedValue({ ok: false, reason: "notOptedIn" });
    const { admin } = setup({ id: "ref-1" }, paid(true));
    await triggerReferralReward(admin, card());
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a silent refresh when sending the message throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sendOffersMock.mockRejectedValue(new Error("push down"));
    const { admin } = setup({ id: "ref-1" }, paid(true));
    await triggerReferralReward(admin, card());
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it("does not message or refresh the referrer when they weren't paid (cap reached)", async () => {
    const { admin } = setup({ id: "ref-1" }, paid(false));
    await triggerReferralReward(admin, card());
    expect(notifyMock).not.toHaveBeenCalled();
    expect(sendOffersMock).not.toHaveBeenCalled();
  });

  it("does nothing when referrals are off, unsupported, or nothing is pending", async () => {
    let s = setup({ id: "ref-1" });
    await triggerReferralReward(s.admin, card(null));
    await triggerReferralReward(s.admin, card(ON, "coupon"));
    expect(s.db.from).not.toHaveBeenCalled();
    s = setup(null);
    await triggerReferralReward(s.admin, card());
    expect(s.rpc).not.toHaveBeenCalled();
  });

  it("does nothing when pay_referral returns no row (already paid)", async () => {
    const { admin } = setup({ id: "ref-1" }, { data: [] });
    await triggerReferralReward(admin, card());
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("never throws: an RPC error leaves the referral for the next scan", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin } = setup({ id: "ref-1" }, { error: { code: "XX" } });
    await expect(triggerReferralReward(admin, card())).resolves.toBeUndefined();
    expect(notifyMock).not.toHaveBeenCalled();
  });
});
