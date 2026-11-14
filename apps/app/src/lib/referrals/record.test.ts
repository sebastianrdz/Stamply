import { describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import type { Program } from "@/types/database";
import { recordReferral } from "./record";

const program = (config: Record<string, unknown> = ON, type = "stamp") =>
  ({ id: "prog-1", business_id: "biz-1", type, config }) as unknown as Program;
const ON = {
  referral: {
    enabled: true,
    referrer_bonus: 1,
    referred_bonus: 1,
    monthly_cap: 5,
  },
};

const args = (over: Record<string, unknown> = {}) => ({
  program: program(),
  referralCode: "abc123",
  customerId: "cust-2",
  cardId: "card-2",
  hasContact: true,
  phoneClash: false,
  ...over,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = (cfg: Record<string, any>) => {
  const db = makeSupabaseMock(cfg);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db, client: { from: db.from } as any };
};
const referrerCard = {
  data: { id: "card-1", program_id: "prog-1" },
  error: null,
};

describe("recordReferral", () => {
  it("records a pending referral for an eligible friend", async () => {
    const { db, client } = admin({
      cards: referrerCard,
      referrals: { error: null },
    });
    expect(await recordReferral(client, args())).toBe("recorded");
    expect(db.builderFor("cards").eq).toHaveBeenCalledWith(
      "referral_code",
      "abc123",
    );
    expect(db.builderFor("referrals").insert).toHaveBeenCalledWith({
      business_id: "biz-1",
      program_id: "prog-1",
      referrer_card_id: "card-1",
      referred_customer_id: "cust-2",
      referred_card_id: "card-2",
    });
  });

  it.each([
    ["no email or phone", { hasContact: false }],
    ["a phone already on file", { phoneClash: true }],
    ["referrals off", { program: program({}) }],
    ["a coupon program", { program: program(ON, "coupon") }],
  ])("ignores %s without touching the database", async (_n, over) => {
    const { db, client } = admin({
      cards: referrerCard,
      referrals: { error: null },
    });
    expect(await recordReferral(client, args(over))).toBe("ignored");
    expect(db.from).not.toHaveBeenCalled();
  });

  it("ignores an unknown code and a code from another program", async () => {
    let r = admin({ cards: { data: null, error: null } });
    expect(await recordReferral(r.client, args())).toBe("ignored");
    r = admin({
      cards: { data: { id: "card-9", program_id: "other" }, error: null },
    });
    expect(await recordReferral(r.client, args())).toBe("ignored");
    expect(r.db.callCounts.referrals).toBeUndefined();
  });

  it("ignores a duplicate and never throws on other errors", async () => {
    const dup = admin({
      cards: referrerCard,
      referrals: { error: { code: "23505", message: "dup" } },
    });
    expect(await recordReferral(dup.client, args())).toBe("ignored");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = admin({
      cards: referrerCard,
      referrals: { error: { code: "XX", message: "boom" } },
    });
    expect(await recordReferral(bad.client, args())).toBe("ignored");
  });
});
