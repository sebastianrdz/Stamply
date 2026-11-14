import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";

const db = { current: makeSupabaseMock({}) };
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: db.current.from }),
}));
const getCardMock = vi.fn();
vi.mock("@/lib/cards/queries", () => ({
  getCardByToken: (...a: unknown[]) => getCardMock(...a),
}));
const rateMock = vi.fn(async () => true);
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => rateMock() }));

import { GET } from "./route";

const REVIEW = "https://g.page/r/abc/review";
const card = (url: string | null) => ({
  id: "card-1",
  business_id: "biz-1",
  customer_id: "cust-1",
  business: { google_review_url: url },
});
const call = (qs = "") =>
  GET(new Request(`https://app.test/r/tok${qs}`) as never, {
    params: Promise.resolve({ token: "tok" }),
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  rateMock.mockResolvedValue(true);
  db.current = makeSupabaseMock({ review_clicks: { error: null } });
});

describe("GET /r/[token]", () => {
  it("logs a message click and redirects to the stored link", async () => {
    getCardMock.mockResolvedValue(card(REVIEW));
    const res = await call();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(REVIEW);
    expect(db.current.builderFor("review_clicks").insert).toHaveBeenCalledWith({
      business_id: "biz-1",
      customer_id: "cust-1",
      source: "message",
    });
  });

  it("records ?s=card as card_page", async () => {
    getCardMock.mockResolvedValue(card(REVIEW));
    await call("?s=card");
    expect(
      db.current.builderFor("review_clicks").insert,
    ).toHaveBeenCalledWith(expect.objectContaining({ source: "card_page" }));
  });

  it("404s on an unknown token and 503s on a lookup failure", async () => {
    getCardMock.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    getCardMock.mockRejectedValue(new Error("down"));
    expect((await call()).status).toBe(503);
  });

  it("falls back to the card page when the business has no link", async () => {
    getCardMock.mockResolvedValue(card(null));
    const res = await call();
    expect(res.headers.get("location")).toBe("https://app.test/c/tok");
    expect(db.current.callCounts.review_clicks).toBeUndefined();
  });

  it("still redirects when the click insert fails", async () => {
    getCardMock.mockResolvedValue(card(REVIEW));
    db.current = makeSupabaseMock({
      review_clicks: { error: { message: "x", code: "XX" } as never },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call()).headers.get("location")).toBe(REVIEW);
  });

  it("redirects without logging when rate limited", async () => {
    getCardMock.mockResolvedValue(card(REVIEW));
    rateMock.mockResolvedValue(false);
    const res = await call();
    expect(res.headers.get("location")).toBe(REVIEW);
    expect(db.current.callCounts.review_clicks).toBeUndefined();
  });
});
