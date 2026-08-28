import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import type { Business, MembershipRole } from "@/types/database";

const cookieSetMock = vi.fn();
const cookieGetMock = vi.fn(() => undefined);
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSetMock, get: cookieGetMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

const nanoidMock = vi.fn((..._args: unknown[]) => "generated-invite-token");
vi.mock("nanoid", () => ({
  nanoid: (...args: unknown[]) => nanoidMock(...args),
}));

const getUserMock = vi.fn();
const requireRoleMock = vi.fn();
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    getUser: (...args: unknown[]) => getUserMock(...args),
    requireRole: (...args: unknown[]) => requireRoleMock(...args),
  };
});

const createClientMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClientMock(...args),
}));

const assertWithinLimitMock = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("@/lib/billing/entitlements", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/billing/entitlements")>();
  return {
    ...actual,
    assertWithinLimit: (...args: unknown[]) => assertWithinLimitMock(...args),
  };
});

const sendTeamInviteEmailMock = vi.fn(
  async (..._args: unknown[]): Promise<{ ok: boolean; error?: string }> => ({
    ok: true,
  }),
);
vi.mock("@/lib/email/send", () => ({
  sendTeamInviteEmail: (...args: unknown[]) => sendTeamInviteEmailMock(...args),
}));

const captureServerEventMock = vi.fn();
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: (...args: unknown[]) => captureServerEventMock(...args),
}));

import { redirect } from "next/navigation";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/auth/session";
import { LimitExceededError } from "@/lib/billing/entitlements";
import {
  acceptInvitation,
  createInvitation,
  removeMembership,
  revokeInvitation,
} from "./actions";

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

function ctx(role: MembershipRole = "owner", biz = business()) {
  return {
    user: { id: "user-1", email: "owner@example.com" },
    membership: { role, business: biz },
  };
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  nanoidMock.mockReturnValue("generated-invite-token");
  assertWithinLimitMock.mockResolvedValue(undefined);
  sendTeamInviteEmailMock.mockResolvedValue({ ok: true });
});

describe("createInvitation", () => {
  it("gates on requireRole(['owner','admin'])", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/dashboard");
    });
    await expect(
      createInvitation({}, form({ email: "a@b.com", role: "employee" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(requireRoleMock).toHaveBeenCalledWith(["owner", "admin"]);
  });

  it("surfaces a validation error for a bad email", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const state = await createInvitation(
      {},
      form({ email: "not-an-email", role: "employee" }),
    );
    expect(state.error).toBe("Ingresa un correo válido.");
  });

  it("returns the LimitExceededError message when the team is full", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    createClientMock.mockResolvedValue(makeSupabaseMock({}));
    assertWithinLimitMock.mockRejectedValue(
      new LimitExceededError("employees", "small", 1),
    );

    const state = await createInvitation(
      {},
      form({ email: "new@example.com", role: "employee" }),
    );
    expect(state.error).toBe(
      "Tu plan permite 1 Empleados. Mejora tu plan para agregar más.",
    );
  });

  it("creates the invite, sends the invite email, and returns the join path on success", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      invitations: { data: null, error: null },
    });
    createClientMock.mockResolvedValue(mock);
    nanoidMock.mockReturnValue("tok-xyz-123");

    const state = await createInvitation(
      {},
      form({ email: "New@Example.com", role: "employee" }),
    );

    expect(state).toEqual({ path: "/join/tok-xyz-123" });
    const insertArg = mock.builderFor("invitations").insert.mock.calls[0][0];
    expect(insertArg.email).toBe("new@example.com"); // lowercased
    expect(insertArg.role).toBe("employee");
    expect(insertArg.business_id).toBe("biz-1");
    expect(insertArg.token).toBe("tok-xyz-123");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/team");

    expect(sendTeamInviteEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@example.com",
        businessName: "The Coffee Spot",
        role: "employee",
        url: expect.stringContaining("/join/tok-xyz-123"),
      }),
    );
    expect(captureServerEventMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "team_invite_sent",
      properties: { role: "employee" },
      groups: { business: "biz-1" },
    });
    // Never include the invitee's email in the analytics event.
    const captureArg = captureServerEventMock.mock.calls[0][0];
    expect(JSON.stringify(captureArg)).not.toContain("new@example.com");
  });

  it("still returns the join path when the invite email fails to send (non-blocking)", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      invitations: { data: null, error: null },
    });
    createClientMock.mockResolvedValue(mock);
    nanoidMock.mockReturnValue("tok-xyz-123");
    sendTeamInviteEmailMock.mockResolvedValue({
      ok: false,
      error: "Resend down",
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const state = await createInvitation(
      {},
      form({ email: "new@example.com", role: "employee" }),
    );

    expect(state).toEqual({ path: "/join/tok-xyz-123" });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("still returns the join path when the invite email send throws (non-blocking)", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      invitations: { data: null, error: null },
    });
    createClientMock.mockResolvedValue(mock);
    nanoidMock.mockReturnValue("tok-xyz-123");
    sendTeamInviteEmailMock.mockRejectedValue(new Error("boom"));

    await expect(
      createInvitation(
        {},
        form({ email: "new@example.com", role: "employee" }),
      ),
    ).rejects.toThrow("boom");
  });

  it("returns the db error message when the insert fails", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        invitations: { data: null, error: { message: "db down" } },
      }),
    );
    const state = await createInvitation(
      {},
      form({ email: "new@example.com", role: "employee" }),
    );
    expect(state.error).toBe("db down");
    expect(captureServerEventMock).not.toHaveBeenCalled();
  });
});

describe("revokeInvitation", () => {
  it("gates on requireRole(['owner','admin']) and deletes by id", async () => {
    requireRoleMock.mockResolvedValue(ctx("admin"));
    const mock = makeSupabaseMock({ invitations: { error: null } });
    createClientMock.mockResolvedValue(mock);

    await revokeInvitation("invite-1");

    expect(requireRoleMock).toHaveBeenCalledWith(["owner", "admin"]);
    expect(mock.builderFor("invitations").delete).toHaveBeenCalled();
    expect(mock.builderFor("invitations").eq).toHaveBeenCalledWith(
      "id",
      "invite-1",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/team");
  });
});

describe("removeMembership", () => {
  it("gates on requireRole(['owner','admin']) and never removes an owner row", async () => {
    requireRoleMock.mockResolvedValue(ctx("admin"));
    const mock = makeSupabaseMock({ memberships: { error: null } });
    createClientMock.mockResolvedValue(mock);

    await removeMembership("member-1");

    expect(requireRoleMock).toHaveBeenCalledWith(["owner", "admin"]);
    expect(mock.builderFor("memberships").delete).toHaveBeenCalled();
    expect(mock.builderFor("memberships").eq).toHaveBeenCalledWith(
      "id",
      "member-1",
    );
    expect(mock.builderFor("memberships").neq).toHaveBeenCalledWith(
      "role",
      "owner",
    );
  });
});

describe("acceptInvitation", () => {
  it("redirects to /login when there's no signed-in user", async () => {
    getUserMock.mockResolvedValue(null);
    await expect(
      acceptInvitation({}, form({ token: "tok-1" })),
    ).rejects.toThrow("NEXT_REDIRECT:/login?next=/join/tok-1");
  });

  it("returns an error for an invalid token", async () => {
    getUserMock.mockResolvedValue({ id: "u1", email: "u@example.com" });
    createAdminClientMock.mockReturnValue(
      makeSupabaseMock({ invitations: { data: null } }),
    );
    const state = await acceptInvitation({}, form({ token: "bad-token" }));
    expect(state.error).toBe("Este enlace de invitación no es válido.");
  });

  it("returns an error when the invite was already accepted", async () => {
    getUserMock.mockResolvedValue({ id: "u1", email: "u@example.com" });
    createAdminClientMock.mockReturnValue(
      makeSupabaseMock({
        invitations: {
          data: {
            id: "inv-1",
            business_id: "biz-1",
            email: "u@example.com",
            role: "employee",
            token: "tok-1",
            expires_at: new Date(Date.now() + 100000).toISOString(),
            accepted_at: new Date().toISOString(),
          },
        },
      }),
    );
    const state = await acceptInvitation({}, form({ token: "tok-1" }));
    expect(state.error).toBe("Esta invitación ya fue utilizada.");
  });

  it("returns an error when the invite has expired", async () => {
    getUserMock.mockResolvedValue({ id: "u1", email: "u@example.com" });
    createAdminClientMock.mockReturnValue(
      makeSupabaseMock({
        invitations: {
          data: {
            id: "inv-1",
            business_id: "biz-1",
            email: "u@example.com",
            role: "employee",
            token: "tok-1",
            expires_at: new Date(Date.now() - 100000).toISOString(),
            accepted_at: null,
          },
        },
      }),
    );
    const state = await acceptInvitation({}, form({ token: "tok-1" }));
    expect(state.error).toBe("Esta invitación venció. Pide una nueva.");
  });

  it("returns an error when the signed-in email doesn't match the invite", async () => {
    getUserMock.mockResolvedValue({
      id: "u1",
      email: "someone-else@example.com",
    });
    createAdminClientMock.mockReturnValue(
      makeSupabaseMock({
        invitations: {
          data: {
            id: "inv-1",
            business_id: "biz-1",
            email: "invited@example.com",
            role: "employee",
            token: "tok-1",
            expires_at: new Date(Date.now() + 100000).toISOString(),
            accepted_at: null,
          },
        },
      }),
    );
    const state = await acceptInvitation({}, form({ token: "tok-1" }));
    expect(state.error).toBe(
      "Esta invitación es para invited@example.com. Inicia sesión con ese correo para aceptarla.",
    );
  });

  it("returns a friendly error when accepting would exceed the employee limit", async () => {
    getUserMock.mockResolvedValue({ id: "u1", email: "invited@example.com" });
    createAdminClientMock.mockReturnValue(
      makeSupabaseMock({
        invitations: {
          data: {
            id: "inv-1",
            business_id: "biz-1",
            email: "invited@example.com",
            role: "employee",
            token: "tok-1",
            expires_at: new Date(Date.now() + 100000).toISOString(),
            accepted_at: null,
          },
        },
        memberships: { data: null }, // no existing membership
        businesses: { data: { id: "biz-1", plan: "small" } },
      }),
    );
    assertWithinLimitMock.mockRejectedValue(
      new LimitExceededError("employees", "small", 1),
    );

    const state = await acceptInvitation({}, form({ token: "tok-1" }));
    expect(state.error).toBe(
      "Este equipo está lleno. Pide al propietario que mejore su plan.",
    );
  });

  it("returns an error when the invite's business no longer exists", async () => {
    getUserMock.mockResolvedValue({ id: "u1", email: "invited@example.com" });
    createAdminClientMock.mockReturnValue(
      makeSupabaseMock({
        invitations: {
          data: {
            id: "inv-1",
            business_id: "biz-1",
            email: "invited@example.com",
            role: "employee",
            token: "tok-1",
            expires_at: new Date(Date.now() + 100000).toISOString(),
            accepted_at: null,
          },
        },
        memberships: { data: null },
        businesses: { data: null },
      }),
    );
    const state = await acceptInvitation({}, form({ token: "tok-1" }));
    expect(state.error).toBe("Ese negocio ya no existe.");
  });

  it("on success: inserts the membership, marks the invite accepted, sets the active-business cookie, and redirects", async () => {
    getUserMock.mockResolvedValue({ id: "u1", email: "invited@example.com" });
    const mock = makeSupabaseMock({
      invitations: [
        {
          data: {
            id: "inv-1",
            business_id: "biz-1",
            email: "invited@example.com",
            role: "employee",
            token: "tok-1",
            expires_at: new Date(Date.now() + 100000).toISOString(),
            accepted_at: null,
          },
        },
        { data: null, error: null }, // the accepted_at update
      ],
      memberships: [{ data: null }, { data: null, error: null }],
      businesses: { data: { id: "biz-1", plan: "small" } },
    });
    createAdminClientMock.mockReturnValue(mock);

    await expect(
      acceptInvitation({}, form({ token: "tok-1" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(cookieSetMock).toHaveBeenCalledWith(
      ACTIVE_BUSINESS_COOKIE,
      "biz-1",
      expect.objectContaining({ path: "/" }),
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
    const membershipInsert = mock.builderFor("memberships", 1).insert.mock
      .calls[0][0];
    expect(membershipInsert).toEqual(
      expect.objectContaining({
        business_id: "biz-1",
        user_id: "u1",
        role: "employee",
      }),
    );
    expect(captureServerEventMock).toHaveBeenCalledWith({
      distinctId: "u1",
      event: "team_invite_accepted",
      properties: { role: "employee" },
      groups: { business: "biz-1" },
    });
  });

  it("skips the insert/limit-check when a membership already exists, but still accepts + redirects", async () => {
    getUserMock.mockResolvedValue({ id: "u1", email: "invited@example.com" });
    const mock = makeSupabaseMock({
      invitations: {
        data: {
          id: "inv-1",
          business_id: "biz-1",
          email: "invited@example.com",
          role: "employee",
          token: "tok-1",
          expires_at: new Date(Date.now() + 100000).toISOString(),
          accepted_at: null,
        },
      },
      memberships: { data: { id: "existing-membership" } },
    });
    createAdminClientMock.mockReturnValue(mock);

    await expect(
      acceptInvitation({}, form({ token: "tok-1" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(assertWithinLimitMock).not.toHaveBeenCalled();
    expect(mock.callCounts.memberships).toBe(1); // only the existence check
    expect(redirect).toHaveBeenCalledWith("/dashboard");
    // Already-a-member path still fires the acceptance event.
    expect(captureServerEventMock).toHaveBeenCalledWith({
      distinctId: "u1",
      event: "team_invite_accepted",
      properties: { role: "employee" },
      groups: { business: "biz-1" },
    });
  });
});
