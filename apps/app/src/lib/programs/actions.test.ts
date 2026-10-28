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

const captureServerEventMock = vi.fn();
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: (...args: unknown[]) => captureServerEventMock(...args),
}));

import { redirect } from "next/navigation";
import {
  createProgram,
  deleteProgram,
  toggleProgramActive,
  updateProgram,
} from "./actions";

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
    const mock = makeSupabaseMock({
      programs: { data: { type: "stamp" }, error: null },
    });
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
    expect(mock.builderFor("programs").update).not.toHaveBeenCalled();
  });

  it("updates the right row, scoped to the caller's business, then redirects", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: [
        { data: { type: "points" }, error: null },
        { data: null, error: null },
      ],
    });
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
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/cards/prog-1?updated=1");

    const builder = mock.builderFor("programs", 1);
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Coffee lovers",
        goal: 100,
        reward_description: "Free drink",
      }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "prog-1");
    expect(builder.eq).toHaveBeenCalledWith("business_id", "biz-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/cards");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/cards/prog-1",
    );
    expect(redirect).toHaveBeenCalledWith(
      "/dashboard/cards/prog-1?updated=1",
    );
    expect(captureServerEventMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "program_updated",
      properties: { program_id: "prog-1", program_type: "points", goal: 100 },
      groups: { business: "biz-1" },
    });
  });

  it("returns the db error message when the update fails", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        programs: [
          { data: { type: "stamp" }, error: null },
          { data: null, error: { message: "db down" } },
        ],
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
    expect(captureServerEventMock).not.toHaveBeenCalled();
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
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/cards");

    expect(mock.builderFor("programs").insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "stamp", goal: 10 }),
    );
    expect(captureServerEventMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "program_created",
      properties: { program_type: "stamp", goal: 10 },
      groups: { business: "biz-1" },
    });
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
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/cards");

    expect(mock.builderFor("programs").insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "points", goal: 100 }),
    );
  });
});

describe("updateProgram — stamp goal cap", () => {
  it("rejects raising a stamp program's goal above 10, without updating", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: { data: { type: "stamp" }, error: null },
    });
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
    expect(mock.builderFor("programs").update).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("validates against the stored type, ignoring a submitted type flip", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: { data: { type: "stamp" }, error: null },
    });
    createClientMock.mockResolvedValue(mock);

    const state = await updateProgram(
      "prog-1",
      {},
      form({
        name: "Coffee card",
        type: "points",
        goal: "100",
        reward_description: "Free coffee",
      }),
    );

    expect(state.error).toBe(STAMP_GOAL_MAX_ES);
    expect(mock.builderFor("programs").update).not.toHaveBeenCalled();
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
      "NEXT_REDIRECT:/dashboard/cards?deleted=1",
    );

    const deleteBuilder = mock.builderFor("programs", 1);
    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(deleteBuilder.eq).toHaveBeenCalledWith("id", "prog-1");
    expect(deleteBuilder.eq).toHaveBeenCalledWith("business_id", "biz-1");
    expect(deleteBuilder.eq).toHaveBeenCalledWith("active", false);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/cards");
    expect(redirect).toHaveBeenCalledWith("/dashboard/cards?deleted=1");
    expect(captureServerEventMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "program_deleted",
      properties: { program_id: "prog-1" },
      groups: { business: "biz-1" },
    });
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
    expect(captureServerEventMock).not.toHaveBeenCalled();
  });
});

describe("toggleProgramActive", () => {
  it("fires program_activated when turning a program on", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: { data: null, error: null },
    });
    createClientMock.mockResolvedValue(mock);

    await toggleProgramActive("prog-1", true);

    expect(mock.builderFor("programs").update).toHaveBeenCalledWith({
      active: true,
    });
    expect(captureServerEventMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "program_activated",
      properties: { program_id: "prog-1" },
      groups: { business: "biz-1" },
    });
  });

  it("does not fire an analytics event when turning a program off", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: { data: null, error: null },
    });
    createClientMock.mockResolvedValue(mock);

    await toggleProgramActive("prog-1", false);

    expect(captureServerEventMock).not.toHaveBeenCalled();
  });

  it("does not fire program_activated when the update errors", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: { data: null, error: { message: "db down" } },
    });
    createClientMock.mockResolvedValue(mock);

    await toggleProgramActive("prog-1", true);

    expect(captureServerEventMock).not.toHaveBeenCalled();
  });
});

describe("program config (per-type)", () => {
  const base = { name: "Card", goal: "1", reward_description: "Offer" };
  const CONFIG_INVALID_ES =
    "La configuración de la tarjeta no es válida. Revísala.";

  it("persists a coupon config and forces goal = 1", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({ programs: { data: null, error: null } });
    createClientMock.mockResolvedValue(mock);
    const config = { discount_kind: "percent", value: 20, max_uses: 5, valid_days: 30 };

    await expect(
      createProgram(
        {},
        form({ ...base, goal: "7", type: "coupon", config: JSON.stringify(config) }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mock.builderFor("programs").insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "coupon", goal: 1, config }),
    );
  });

  it("persists points tiers and membership config", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({ programs: { data: null, error: null } });
    createClientMock.mockResolvedValue(mock);
    const points = { earn: "spend", points_per_unit: 2, tiers: [{ points: 100, reward: "Coffee" }] };
    await expect(
      createProgram({}, form({ ...base, goal: "100", type: "points", config: JSON.stringify(points) })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mock.builderFor("programs", 0).insert).toHaveBeenCalledWith(
      expect.objectContaining({ config: points }),
    );

    const membership = { access: "free", renew_days: 30, tiers: [{ name: "Gold", benefits: "x" }] };
    await expect(
      createProgram({}, form({ ...base, type: "membership", config: JSON.stringify(membership) })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mock.builderFor("programs", 1).insert).toHaveBeenCalledWith(
      expect.objectContaining({ config: membership, goal: 1 }),
    );
  });

  it.each([
    ["coupon missing discount_kind", "coupon", { value: 5 }],
    ["percent over 100", "coupon", { discount_kind: "percent", value: 150 }],
    ["membership renew_days 0", "membership", { access: "free", renew_days: 0 }],
    ["points with 11 tiers", "points", { tiers: Array.from({ length: 11 }, (_, i) => ({ points: i + 1, reward: "r" })) }],
  ])("rejects invalid config: %s", async (_n, type, config) => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({ programs: { data: null, error: null } });
    createClientMock.mockResolvedValue(mock);
    const state = await createProgram(
      {},
      form({ ...base, type, config: JSON.stringify(config) }),
    );
    expect(state.error).toBe(CONFIG_INVALID_ES);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("rejects malformed config JSON", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    createClientMock.mockResolvedValue(makeSupabaseMock({}));
    const state = await createProgram({}, form({ ...base, type: "coupon", config: "{nope" }));
    expect(state.error).toBe(CONFIG_INVALID_ES);
  });

  it("update: config is updatable but type stays locked to the stored one", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const mock = makeSupabaseMock({
      programs: [
        { data: { type: "coupon", config: {} }, error: null },
        { data: null, error: null },
      ],
    });
    createClientMock.mockResolvedValue(mock);
    const config = { discount_kind: "fixed", value: 500, max_uses: null, valid_days: null };
    await expect(
      updateProgram("prog-1", {}, form({ ...base, type: "stamp", config: JSON.stringify(config) })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mock.builderFor("programs", 1).update).toHaveBeenCalledWith(
      expect.objectContaining({ goal: 1, config }),
    );
  });

  it("update: absent config field keeps the stored config valid", async () => {
    requireRoleMock.mockResolvedValue(ctx("owner"));
    const stored = { discount_kind: "item", value: 1, max_uses: 3, valid_days: 10 };
    const mock = makeSupabaseMock({
      programs: [
        { data: { type: "coupon", config: stored }, error: null },
        { data: null, error: null },
      ],
    });
    createClientMock.mockResolvedValue(mock);
    await expect(updateProgram("prog-1", {}, form({ ...base }))).rejects.toThrow("NEXT_REDIRECT");
    expect(mock.builderFor("programs", 1).update).toHaveBeenCalledWith(
      expect.objectContaining({ config: stored }),
    );
  });
});
