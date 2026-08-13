import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import type { Business, MembershipRole } from "@/types/database";

const cookieGetMock = vi.fn(() => undefined);
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGetMock })),
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

const requireRoleMock = vi.fn();
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...args),
  };
});

const createClientMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
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

import { redirect } from "next/navigation";
import { createProgram, deleteProgram, updateProgram } from "./actions";

const STAMP_GOAL_MAX_ES =
  "Las tarjetas de sellos pueden tener como máximo 10 sellos.";

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
  assertWithinLimitMock.mockResolvedValue(undefined);
  cookieGetMock.mockReturnValue(undefined); // locale falls back to default ("es")
});

describe("updateProgram", () => {
  it("gates on requireRole(['owner','admin'])", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/dashboard");
    });
    await expect(
      updateProgram(
        "prog-1",
        {},
        form({
          name: "Coffee card",
          type: "stamp",
          goal: "10",
          reward_description: "Free coffee",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(requireRoleMock).toHaveBeenCalledWith(["owner", "admin"]);
  });

  it("returns a validation error without updating", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({});
    createClientMock.mockResolvedValue(mock);

    const state = await updateProgram(
      "prog-1",
      {},
      form({
        name: "C",
        type: "stamp",
        goal: "10",
        reward_description: "Free coffee",
      }),
    );

    expect(state.error).toBe("Ponle un nombre al programa.");
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("updates the right row, scoped to the caller's business, then redirects", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({ programs: { data: null, error: null } });
    createClientMock.mockResolvedValue(mock);

    await expect(
      updateProgram(
        "prog-1",
        {},
        form({
          name: "Coffee lovers",
          type: "points",
          goal: "100",
          reward_description: "Free drink",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/programs/prog-1");

    const builder = mock.builderFor("programs");
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Coffee lovers",
        type: "points",
        goal: 100,
        reward_description: "Free drink",
      }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "prog-1");
    expect(builder.eq).toHaveBeenCalledWith("business_id", "biz-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/programs");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/programs/prog-1",
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard/programs/prog-1");
  });

  it("returns the db error message when the update fails", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        programs: { data: null, error: { message: "db down" } },
      }),
    );
    const state = await updateProgram(
      "prog-1",
      {},
      form({
        name: "Coffee lovers",
        type: "stamp",
        goal: "10",
        reward_description: "Free coffee",
      }),
    );
    expect(state.error).toBe("db down");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("createProgram — stamp goal cap", () => {
  it("rejects a stamp program with a goal above 10, without inserting", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({ programs: { data: null, error: null } });
    createClientMock.mockResolvedValue(mock);

    const state = await createProgram(
      {},
      form({
        name: "Coffee card",
        type: "stamp",
        goal: "11",
        reward_description: "Free coffee",
      }),
    );

    expect(state.error).toBe(STAMP_GOAL_MAX_ES);
    expect(mock.from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("allows a stamp program at exactly 10 and inserts it", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({ programs: { data: null, error: null } });
    createClientMock.mockResolvedValue(mock);

    await expect(
      createProgram(
        {},
        form({
          name: "Coffee card",
          type: "stamp",
          goal: "10",
          reward_description: "Free coffee",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/programs");

    expect(mock.builderFor("programs").insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "stamp", goal: 10 }),
    );
  });

  it("allows a points program with a goal above 10 (cap is stamp-only)", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({ programs: { data: null, error: null } });
    createClientMock.mockResolvedValue(mock);

    await expect(
      createProgram(
        {},
        form({
          name: "Points club",
          type: "points",
          goal: "100",
          reward_description: "Free drink",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/programs");

    expect(mock.builderFor("programs").insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "points", goal: 100 }),
    );
  });
});

describe("updateProgram — stamp goal cap", () => {
  it("rejects raising a stamp program's goal above 10, without updating", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({ programs: { data: null, error: null } });
    createClientMock.mockResolvedValue(mock);

    const state = await updateProgram(
      "prog-1",
      {},
      form({
        name: "Coffee card",
        type: "stamp",
        goal: "25",
        reward_description: "Free coffee",
      }),
    );

    expect(state.error).toBe(STAMP_GOAL_MAX_ES);
    expect(mock.from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("deleteProgram", () => {
  it("gates on requireRole(['owner','admin'])", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/dashboard");
    });
    await expect(deleteProgram("prog-1", {}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
    expect(requireRoleMock).toHaveBeenCalledWith(["owner", "admin"]);
  });

  it("rejects when the program is still active — no delete call, no redirect", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: { data: { id: "prog-1", active: true } },
    });
    createClientMock.mockResolvedValue(mock);

    const state = await deleteProgram("prog-1", {}, new FormData());

    expect(state.error).toBe(
      "No se puede eliminar un programa activo. Desactívalo primero.",
    );
    expect(mock.builderFor("programs").delete).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns a not-found error when the program isn't in the caller's business", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    createClientMock.mockResolvedValue(
      makeSupabaseMock({ programs: { data: null } }),
    );

    const state = await deleteProgram("prog-1", {}, new FormData());

    expect(state.error).toBe("No se encontró el programa.");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("deletes an inactive program (business-scoped) and redirects to the list", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: [
        { data: { id: "prog-1", active: false } },
        { data: null, error: null, count: 1 }, // the delete: 1 row affected
      ],
    });
    createClientMock.mockResolvedValue(mock);

    await expect(deleteProgram("prog-1", {}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/programs",
    );

    const deleteBuilder = mock.builderFor("programs", 1);
    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(deleteBuilder.eq).toHaveBeenCalledWith("id", "prog-1");
    expect(deleteBuilder.eq).toHaveBeenCalledWith("business_id", "biz-1");
    expect(deleteBuilder.eq).toHaveBeenCalledWith("active", false);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/programs");
    expect(redirect).toHaveBeenCalledWith("/dashboard/programs");
  });

  it("returns the db error message when the delete fails", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: [
        { data: { id: "prog-1", active: false } },
        { data: null, error: { message: "db down" } },
      ],
    });
    createClientMock.mockResolvedValue(mock);

    const state = await deleteProgram("prog-1", {}, new FormData());
    expect(state.error).toBe("db down");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("loses the active-guard race atomically: DELETE affects 0 rows (program was re-enabled between the check and the delete) → returns an error, does NOT redirect", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: [
        { data: { id: "prog-1", active: false } }, // passes the early check...
        { data: null, error: null, count: 0 }, // ...but the guarded DELETE matches nothing
      ],
    });
    createClientMock.mockResolvedValue(mock);

    const state = await deleteProgram("prog-1", {}, new FormData());

    expect(state.error).toBe(
      "No se puede eliminar un programa activo. Desactívalo primero.",
    );
    const deleteBuilder = mock.builderFor("programs", 1);
    expect(deleteBuilder.eq).toHaveBeenCalledWith("active", false);
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
