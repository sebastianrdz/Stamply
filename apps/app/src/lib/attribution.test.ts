import { describe, expect, it, vi } from "vitest";
import { conversionPercent, getAttribution } from "./attribution";

const biz = { id: "b1", timezone: "America/Mexico_City" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = (rpc: any) => ({ rpc }) as any;

describe("getAttribution", () => {
  it("keys broadcasts by offer id and automations by automation id", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        { offer_id: "o1", automation_id: null, sent: 10, returned: 3 },
        { offer_id: null, automation_id: "a1", sent: 4, returned: 1 },
      ],
      error: null,
    }));
    const r = await getAttribution(
      client(rpc),
      biz,
      90,
      new Date("2026-11-14T00:00:00Z"),
    );
    expect(r.byOffer.get("o1")).toEqual({ sent: 10, returned: 3 });
    expect(r.byAutomation.get("a1")).toEqual({ sent: 4, returned: 1 });
    expect(rpc).toHaveBeenCalledWith("message_attribution", {
      p_business_id: "b1",
      p_since: "2026-08-16T00:00:00.000Z",
      p_tz: "America/Mexico_City",
    });
  });

  it("throws on RPC error", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "X" } }));
    await expect(getAttribution(client(rpc), biz)).rejects.toEqual({ code: "X" });
  });
});

describe("conversionPercent", () => {
  it("rounds and avoids divide-by-zero", () => {
    expect(conversionPercent({ sent: 3, returned: 1 })).toBe(33);
    expect(conversionPercent({ sent: 0, returned: 0 })).toBe(0);
  });
});
