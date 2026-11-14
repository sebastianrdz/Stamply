import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";

vi.mock("@/lib/roi", () => ({ getRoiForRange: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendMonthlySummaryEmail: vi.fn() }));

import { getRoiForRange } from "@/lib/roi";
import { sendMonthlySummaryEmail } from "@/lib/email/send";
import { previousMonth, runMonthlySummaries } from "./roi-monthly";

const roiMock = vi.mocked(getRoiForRange);
const sendMock = vi.mocked(sendMonthlySummaryEmail);

const BIZ = {
  id: "b1",
  name: "Cafe",
  timezone: "America/Mexico_City",
  locale: null,
  owner_user_id: "u1",
  average_ticket_cents: 15000,
};
const ROI = {
  activeCustomers: 10,
  returningCustomers: 4,
  returningVisits: 6,
  repeatRate: 0.4,
  avgDaysBetween: 9,
  atRisk: 1,
  atRiskFromDays: 30,
  attributedVisits: 2,
  estimatedRevenueCents: 90000,
};
const NOW = new Date("2026-12-02T15:00:00Z");

// `claim` is the insert result, then the delete result for a release.
function setup(claim: object = {}, email: string | null = "owner@x.com") {
  const db = makeSupabaseMock({
    businesses: { data: [BIZ] },
    monthly_summaries: [claim, {}],
  });
  const admin = {
    from: db.from,
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: email ? { email } : null } })) } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { db, admin };
}

beforeEach(() => {
  vi.clearAllMocks();
  roiMock.mockResolvedValue(ROI);
  sendMock.mockResolvedValue({ ok: true });
});

describe("previousMonth", () => {
  it("returns the previous local month and today's local day", () => {
    expect(previousMonth("America/Mexico_City", NOW)).toEqual({
      key: "2026-11",
      from: "2026-11-01",
      to: "2026-11-30",
      localDay: 2,
    });
  });
  it("uses the local date at the month boundary and wraps the year", () => {
    // 03:00Z on Jan 1 is still Dec 31 in Mexico City -> previous month is November.
    expect(
      previousMonth("America/Mexico_City", new Date("2027-01-01T03:00:00Z")),
    ).toMatchObject({ key: "2026-11", from: "2026-11-01", to: "2026-11-30" });
    expect(previousMonth("UTC", new Date("2027-01-01T03:00:00Z"))).toMatchObject({
      key: "2026-12",
      to: "2026-12-31",
    });
  });
});

describe("runMonthlySummaries", () => {
  it("claims the month, sends in Spanish by default and counts it", async () => {
    const { admin } = setup();
    const c = await runMonthlySummaries(admin, NOW);
    expect(c).toEqual({ sent: 1, skipped: 0, errors: 0 });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@x.com",
        locale: "es",
        returningCustomers: 4,
        repeatRatePercent: 40,
        revenue: expect.stringContaining("900"),
      }),
    );
  });

  it("hides revenue when no average ticket is set", async () => {
    roiMock.mockResolvedValue({ ...ROI, estimatedRevenueCents: null });
    await runMonthlySummaries(setup().admin, NOW);
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ revenue: null }));
  });

  it("skips without sending when the month was already claimed", async () => {
    const { admin } = setup({ error: { code: "23505", message: "dup" } });
    expect(await runMonthlySummaries(admin, NOW)).toEqual({ sent: 0, skipped: 1, errors: 0 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("skips (keeping the claim) when nobody visited", async () => {
    roiMock.mockResolvedValue({ ...ROI, activeCustomers: 0 });
    const { admin, db } = setup();
    expect(await runMonthlySummaries(admin, NOW)).toEqual({ sent: 0, skipped: 1, errors: 0 });
    expect(sendMock).not.toHaveBeenCalled();
    expect(db.callCounts.monthly_summaries).toBe(1); // insert only, no delete
  });

  it("skips when the owner has no email", async () => {
    const { admin } = setup({}, null);
    expect(await runMonthlySummaries(admin, NOW)).toMatchObject({ sent: 0, skipped: 1 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("releases the claim when the send fails so a later run retries", async () => {
    sendMock.mockResolvedValue({ ok: false, error: "boom" });
    const { admin, db } = setup();
    expect(await runMonthlySummaries(admin, NOW)).toEqual({ sent: 0, skipped: 0, errors: 1 });
    expect(db.callCounts.monthly_summaries).toBe(2); // insert + delete
  });

  it("releases the claim when computing the ROI throws", async () => {
    roiMock.mockRejectedValue(new Error("rpc down"));
    const { admin, db } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await runMonthlySummaries(admin, NOW)).toMatchObject({ errors: 1 });
    expect(db.callCounts.monthly_summaries).toBe(2);
  });

  it("does nothing after the first week of the month", async () => {
    const { admin, db } = setup();
    const c = await runMonthlySummaries(admin, new Date("2026-12-09T15:00:00Z"));
    expect(c).toEqual({ sent: 0, skipped: 0, errors: 0 });
    expect(db.callCounts.monthly_summaries).toBeUndefined();
  });
});
