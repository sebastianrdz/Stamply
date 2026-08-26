import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Business } from "@/types/database";

const cookieDeleteMock = vi.fn();
const cookieGetMock = vi.fn(() => undefined);
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ delete: cookieDeleteMock, get: cookieGetMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

const getUserMock = vi.fn();
const getMembershipsMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  ACTIVE_BUSINESS_COOKIE: "stamply_active_business",
  getUser: (...args: unknown[]) => getUserMock(...args),
  getMemberships: (...args: unknown[]) => getMembershipsMock(...args),
}));

const deleteUserMock = vi.fn();
const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

import { redirect } from "next/navigation";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/auth/session";
import { deleteAccount } from "./profile-actions";

function business(overrides: Partial<Business> = {}): Business {
  return {
    id: "biz-1",
    name: "The Coffee Spot",
    slug: "coffee-spot",
    owner_user_id: "owner-1",
    plan: "small",
    subscription_status: "active",
    stripe_customer_id: null,
    brand_primary_color: "#7c5cfc",
    brand_secondary_color: "#000000",
    logo_url: null,
    background_image_url: null,
    show_business_name: true,
    timezone: "UTC",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createAdminClientMock.mockReturnValue({
    auth: { admin: { deleteUser: deleteUserMock } },
  });
  deleteUserMock.mockResolvedValue({ error: null });
});

describe("deleteAccount", () => {
  it("returns notSignedIn when there is no signed-in user, and never calls deleteUser", async () => {
    getUserMock.mockResolvedValue(null);

    const state = await deleteAccount({}, new FormData());

    expect(state.error).toBe("No has iniciado sesión.");
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("blocks with the owned-business error (interpolated names) when the user owns at least one business", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    getMembershipsMock.mockResolvedValue([
      {
        role: "owner",
        business: business({
          id: "biz-1",
          name: "Bean & Brew",
          owner_user_id: "user-1",
        }),
      },
      { role: "employee", business: business({ id: "biz-2", name: "Other Shop" }) },
    ]);

    const state = await deleteAccount({}, new FormData());

    expect(state.error).toBe(
      "Debes eliminar o transferir la propiedad de Bean & Brew antes de eliminar tu cuenta.",
    );
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("interpolates multiple owned business names when the user owns more than one", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    getMembershipsMock.mockResolvedValue([
      {
        role: "owner",
        business: business({
          id: "biz-1",
          name: "Bean & Brew",
          owner_user_id: "user-1",
        }),
      },
      {
        role: "owner",
        business: business({
          id: "biz-2",
          name: "Second Shop",
          owner_user_id: "user-1",
        }),
      },
    ]);

    const state = await deleteAccount({}, new FormData());

    expect(state.error).toBe(
      "Debes eliminar o transferir la propiedad de Bean & Brew, Second Shop antes de eliminar tu cuenta.",
    );
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("calls admin.auth.admin.deleteUser and redirects to /login when the user owns no businesses", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    // Regression guard for the role-vs-owner_user_id fix: the first membership
    // has role "owner" but its business is NOT owned by user-1 (owner_user_id
    // defaults to "owner-1" in the fixture) -- the check must key off
    // owner_user_id, not role, or this would wrongly block deletion.
    getMembershipsMock.mockResolvedValue([
      { role: "owner", business: business({ id: "biz-3", name: "Someone Else's Shop" }) },
      { role: "employee", business: business({ id: "biz-2", name: "Other Shop" }) },
    ]);

    await expect(deleteAccount({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );

    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
    expect(cookieDeleteMock).toHaveBeenCalledWith(ACTIVE_BUSINESS_COOKIE);
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("also succeeds and redirects when the user has no memberships at all", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    getMembershipsMock.mockResolvedValue([]);

    await expect(deleteAccount({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
  });

  it("returns the error when deleteUser fails, without redirecting", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
    getMembershipsMock.mockResolvedValue([]);
    deleteUserMock.mockResolvedValue({ error: { message: "auth service down" } });

    const state = await deleteAccount({}, new FormData());

    expect(state.error).toBe("auth service down");
    expect(redirect).not.toHaveBeenCalled();
    expect(cookieDeleteMock).not.toHaveBeenCalled();
  });
});
