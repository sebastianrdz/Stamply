import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";

const biz = { current: { id: "biz-1", google_review_url: "https://g.page/r/x" as string | null } };
vi.mock("@/lib/auth/session", () => ({
  requireRole: async () => ({ user: { id: "u1" }, membership: { business: biz.current } }),
}));
const db = { current: makeSupabaseMock({}) };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: db.current.from }),
}));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@stamply/i18n/locale", () => ({ getLocale: async () => "en" }));

import { saveAutomation } from "./actions";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
// `active` is the "on" checkbox; pass active: "" to omit it (disabled).
const review = (over: Record<string, string> = {}) => {
  const f = form({
    type: "review_prompt",
    active: "on",
    message: "Thanks {name}! {link}",
    reward_description: "ignored",
    ...over,
  });
  if (over.active === "") f.delete("active");
  return f;
};

beforeEach(() => {
  biz.current = { id: "biz-1", google_review_url: "https://g.page/r/x" };
  db.current = makeSupabaseMock({ reward_definitions: { data: null, error: null } });
});

describe("saveAutomation review_prompt", () => {
  it("saves with the link last, and drops any reward text", async () => {
    expect(await saveAutomation({}, review())).toEqual({ saved: true });
    expect(db.current.builderFor("reward_definitions", 1).insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "review_prompt", reward_description: null }),
    );
  });

  it("requires the link at the end of the message when enabling", async () => {
    const r = await saveAutomation({}, review({ message: "{link} thanks" }));
    expect(r.error).toMatch(/\{link\}/);
  });

  it("requires a business review link when enabling", async () => {
    biz.current.google_review_url = null;
    expect((await saveAutomation({}, review())).error).toMatch(/review link/i);
  });

  it("rejects messages over 120 characters", async () => {
    const r = await saveAutomation({}, review({ message: "x".repeat(121) + " {link}" }));
    expect(r.error).toMatch(/120/);
  });

  it("lets a disabled draft save without a link", async () => {
    biz.current.google_review_url = null;
    const r = await saveAutomation({}, review({ active: "", message: "draft" }));
    expect(r.error).toBeUndefined();
  });
});
