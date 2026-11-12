import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

const getUserMock = vi.fn();
const getActiveBusinessMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getUser: () => getUserMock(),
  getActiveBusiness: () => getActiveBusinessMock(),
}));

import { requireOnboardingBusiness } from "./onboarding";

const membership = (role: string, plan = "none") => ({
  role,
  business: { id: "biz-1", plan },
});

describe("requireOnboardingBusiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ id: "user-1" });
    getActiveBusinessMock.mockResolvedValue(membership("owner"));
  });

  it("redirects to /login without a user", async () => {
    getUserMock.mockResolvedValue(null);
    await expect(requireOnboardingBusiness()).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
  });

  it("redirects to /onboarding without a business", async () => {
    getActiveBusinessMock.mockResolvedValue(null);
    await expect(requireOnboardingBusiness()).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );
  });

  it("redirects to /dashboard once a plan is chosen", async () => {
    getActiveBusinessMock.mockResolvedValue(membership("owner", "pro"));
    await expect(requireOnboardingBusiness()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });

  it("redirects staff to /onboarding/plan", async () => {
    getActiveBusinessMock.mockResolvedValue(membership("staff"));
    await expect(requireOnboardingBusiness()).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding/plan",
    );
  });

  it.each(["owner", "admin"])("returns context for %s", async (role) => {
    const m = membership(role);
    getActiveBusinessMock.mockResolvedValue(m);
    await expect(requireOnboardingBusiness()).resolves.toEqual({
      user: { id: "user-1" },
      membership: m,
    });
  });
});
