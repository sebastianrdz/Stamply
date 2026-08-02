import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Business, MembershipRole } from "@/types/database";

const getUserMock = vi.fn();
const membershipsBuilder = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
};
const cookieGetMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGetMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: vi.fn(() => membershipsBuilder),
  })),
}));

// Imported after the mocks are registered.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACTIVE_BUSINESS_COOKIE,
  getActiveBusiness,
  getMemberships,
  getUser,
  requireBusiness,
  requireRole,
} from "./session";

function business(id: string): Business {
  return {
    id,
    name: `Business ${id}`,
    slug: `biz-${id}`,
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
  };
}

function fakeUser(id = "user-1") {
  return { id, email: "user@example.com" } as never;
}

function setupMemberships(rows: Array<{ role: MembershipRole; business: Business | null }>) {
  membershipsBuilder.select.mockReturnValue(membershipsBuilder);
  membershipsBuilder.eq.mockReturnValue(membershipsBuilder);
  membershipsBuilder.order.mockResolvedValue({ data: rows, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieGetMock.mockReturnValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getUser", () => {
  it("returns the user when signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    const user = await getUser();
    expect(user).toEqual(fakeUser());
  });

  it("returns null when signed out", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const user = await getUser();
    expect(user).toBeNull();
  });
});

describe("getMemberships", () => {
  it("returns [] when there is no user (never queries memberships)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const memberships = await getMemberships();
    expect(memberships).toEqual([]);
  });

  it("maps {role, business} rows correctly", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    const bizA = business("a");
    setupMemberships([{ role: "owner", business: bizA }]);
    const memberships = await getMemberships();
    expect(memberships).toEqual([{ role: "owner", business: bizA }]);
  });

  it("filters out rows whose business is falsy", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    const bizA = business("a");
    setupMemberships([
      { role: "owner", business: bizA },
      { role: "employee", business: null },
    ]);
    const memberships = await getMemberships();
    expect(memberships).toEqual([{ role: "owner", business: bizA }]);
  });

  it("returns [] when the query errors", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    membershipsBuilder.select.mockReturnValue(membershipsBuilder);
    membershipsBuilder.eq.mockReturnValue(membershipsBuilder);
    membershipsBuilder.order.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const memberships = await getMemberships();
    expect(memberships).toEqual([]);
  });
});

describe("getActiveBusiness", () => {
  it("returns null when there are no memberships", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    expect(await getActiveBusiness()).toBeNull();
  });

  it("picks the membership matching the active-business cookie", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    const bizA = business("a");
    const bizB = business("b");
    setupMemberships([
      { role: "owner", business: bizA },
      { role: "admin", business: bizB },
    ]);
    cookieGetMock.mockReturnValue({ value: "b" });

    const active = await getActiveBusiness();
    expect(active).toEqual({ role: "admin", business: bizB });
    expect(cookieGetMock).toHaveBeenCalledWith(ACTIVE_BUSINESS_COOKIE);
  });

  it("falls back to memberships[0] when the cookie is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    const bizA = business("a");
    const bizB = business("b");
    setupMemberships([
      { role: "owner", business: bizA },
      { role: "admin", business: bizB },
    ]);
    cookieGetMock.mockReturnValue(undefined);

    const active = await getActiveBusiness();
    expect(active).toEqual({ role: "owner", business: bizA });
  });

  it("falls back to memberships[0] when the cookie doesn't match any membership", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    const bizA = business("a");
    const bizB = business("b");
    setupMemberships([
      { role: "owner", business: bizA },
      { role: "admin", business: bizB },
    ]);
    cookieGetMock.mockReturnValue({ value: "does-not-exist" });

    const active = await getActiveBusiness();
    expect(active).toEqual({ role: "owner", business: bizA });
  });
});

describe("requireBusiness", () => {
  it("redirects to /login when there is no user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(requireBusiness()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /onboarding when the user has no memberships", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    setupMemberships([]);
    await expect(requireBusiness()).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("returns {user, membership} when both exist", async () => {
    const user = fakeUser();
    getUserMock.mockResolvedValue({ data: { user } });
    const bizA = business("a");
    setupMemberships([{ role: "employee", business: bizA }]);

    const ctx = await requireBusiness();
    expect(ctx.user).toEqual(user);
    expect(ctx.membership).toEqual({ role: "employee", business: bizA });
  });
});

describe("requireRole — owner/admin gate (programs/locations/team/analytics/settings)", () => {
  it("redirects an employee to /dashboard", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    setupMemberships([{ role: "employee", business: business("a") }]);
    await expect(requireRole(["owner", "admin"])).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("allows an admin through", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    setupMemberships([{ role: "admin", business: business("a") }]);
    const ctx = await requireRole(["owner", "admin"]);
    expect(ctx.membership.role).toBe("admin");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("allows an owner through", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    setupMemberships([{ role: "owner", business: business("a") }]);
    const ctx = await requireRole(["owner", "admin"]);
    expect(ctx.membership.role).toBe("owner");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("requireRole — owner-only gate (billing)", () => {
  it("redirects an admin to /dashboard (billing is owner-only, not admin)", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    setupMemberships([{ role: "admin", business: business("a") }]);
    await expect(requireRole(["owner"])).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("allows an owner through", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    setupMemberships([{ role: "owner", business: business("a") }]);
    const ctx = await requireRole(["owner"]);
    expect(ctx.membership.role).toBe("owner");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects an employee to /dashboard", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    setupMemberships([{ role: "employee", business: business("a") }]);
    await expect(requireRole(["owner"])).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });
});

describe("requireBusiness alone — dashboard overview/customers/scan/settings (any role)", () => {
  it.each<MembershipRole>(["employee", "admin", "owner"])(
    "role=%s passes requireBusiness without a role check",
    async (role) => {
      getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
      setupMemberships([{ role, business: business("a") }]);
      const ctx = await requireBusiness();
      expect(ctx.membership.role).toBe(role);
      expect(redirect).not.toHaveBeenCalled();
    },
  );
});

// Sanity check that next/headers is actually being exercised through our mock.
describe("cookies plumbing", () => {
  it("reads the active-business cookie via next/headers cookies()", async () => {
    getUserMock.mockResolvedValue({ data: { user: fakeUser() } });
    setupMemberships([{ role: "owner", business: business("a") }]);
    await getActiveBusiness();
    expect(cookies).toHaveBeenCalled();
  });
});
