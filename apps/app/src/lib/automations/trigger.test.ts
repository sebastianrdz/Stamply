import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";

const deliverMock = vi.fn();
vi.mock("./deliver", () => ({ deliverAutomation: (...a: unknown[]) => deliverMock(...a) }));

import { triggerReviewPrompt } from "./trigger";

const DEF = { id: "def-1", business_id: "biz-1", type: "review_prompt", active: true };
const card = (url: string | null = "https://g.page/r/abc/review") => ({
  business_id: "biz-1",
  customer_id: "cust-1",
  pass_auth_token: "tok-1",
  business: { name: "Cafe", google_review_url: url },
  customer: { full_name: "Ana Perez" },
});
const admin = (def: unknown = DEF) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ from: makeSupabaseMock({ reward_definitions: { data: def } }).from }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  deliverMock.mockResolvedValue("sent");
});

describe("triggerReviewPrompt", () => {
  it("sends once-per-customer with the tracked link", async () => {
    await triggerReviewPrompt(admin(), card());
    expect(deliverMock).toHaveBeenCalledWith(
      expect.anything(),
      DEF,
      "cust-1",
      "once",
      { name: "Ana", business: "Cafe", link: expect.stringMatching(/\/r\/tok-1$/) },
    );
  });

  it("does nothing without a review link or an active automation", async () => {
    await triggerReviewPrompt(admin(), card(null));
    await triggerReviewPrompt(admin(null), card());
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    deliverMock.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(triggerReviewPrompt(admin(), card())).resolves.toBeUndefined();
  });
});
