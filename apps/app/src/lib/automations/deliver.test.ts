import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sendMock = vi.fn();
vi.mock("@/lib/offers/send", () => ({
  sendWalletOffers: (...a: unknown[]) => sendMock(...a),
}));
vi.mock("@/lib/rewards/queries", () => ({
  grantStandaloneReward: vi.fn(async () => true),
}));

import { deliverAutomation } from "./deliver";
import type { RewardDefinition } from "@/types/database";

// In-memory automation_runs honouring the unique (automation, customer, period) key.
const runs = new Set<string>();
let deleted = 0;
const admin = {
  from: () => ({
    insert: (row: { automation_id: string; customer_id: string; period_key: string }) => ({
      select: () => ({
        single: async () => {
          const k = `${row.automation_id}|${row.customer_id}|${row.period_key}`;
          if (runs.has(k)) return { data: null, error: { code: "23505" } };
          runs.add(k);
          return { data: { id: k }, error: null };
        },
      }),
    }),
    delete: () => ({
      eq: async (_c: string, id: string) => {
        runs.delete(id);
        deleted += 1;
        return { error: null };
      },
    }),
  }),
} as never;

const def = {
  id: "a1",
  business_id: "b1",
  type: "win_back",
  active: true,
  message: "Hi {name}, {days} days at {business}",
  reward_description: null,
} as RewardDefinition;

beforeEach(() => {
  runs.clear();
  deleted = 0;
  sendMock.mockReset();
  sendMock.mockResolvedValue({ ok: true, sent: 1 });
});

describe("deliverAutomation", () => {
  it("sends once and a second run for the same period sends nothing", async () => {
    const vars = { name: "Ana", business: "Cafe", days: 30 };
    expect(await deliverAutomation(admin, def, "c1", "2026-08-31", vars)).toBe("sent");
    expect(await deliverAutomation(admin, def, "c1", "2026-08-31", vars)).toBe("duplicate");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][1]).toMatchObject({
      body: "Hi Ana, 30 days at Cafe",
      customerIds: ["c1"],
    });
    // A new period (next lapse) sends again.
    expect(await deliverAutomation(admin, def, "c1", "2026-10-01", vars)).toBe("sent");
  });

  it("skips inactive automations and empty messages without claiming", async () => {
    expect(await deliverAutomation(admin, { ...def, active: false }, "c1", "k", {})).toBe("skipped");
    expect(await deliverAutomation(admin, { ...def, message: " " }, "c1", "k", {})).toBe("skipped");
    expect(runs.size).toBe(0);
  });

  it("keeps the claim when the push throws after the offer was stored (no duplicate offer on retry)", async () => {
    sendMock.mockRejectedValueOnce(new Error("apns down"));
    await expect(deliverAutomation(admin, def, "c1", "k", {})).rejects.toThrow("apns down");
    expect(deleted).toBe(0);
    expect(await deliverAutomation(admin, def, "c1", "k", {})).toBe("duplicate");
  });

  it("releases the claim when the failure happened before any offer was inserted", async () => {
    sendMock.mockResolvedValueOnce({ ok: false, reason: "insert" });
    await expect(deliverAutomation(admin, def, "c1", "k", {})).rejects.toThrow("insert");
    expect(deleted).toBe(1);
    expect(await deliverAutomation(admin, def, "c1", "k", {})).toBe("sent");
  });

  it("tags the offer with the automation id", async () => {
    await deliverAutomation(admin, def, "c1", "k", {});
    expect(sendMock.mock.calls[0][1]).toMatchObject({ automationId: "a1" });
  });

  it("keeps the claim for a customer who is not opted in", async () => {
    sendMock.mockResolvedValue({ ok: false, reason: "noRecipients" });
    expect(await deliverAutomation(admin, def, "c1", "k", {})).toBe("skipped");
    expect(deleted).toBe(0);
  });
});
