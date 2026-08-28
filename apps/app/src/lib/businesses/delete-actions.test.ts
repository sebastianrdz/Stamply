import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeSupabaseMock,
  type FakeQueryResult,
} from "@/lib/test-utils/supabase-mock";
import type { Business, MembershipRole } from "@/types/database";

const cookieSetMock = vi.fn();
const cookieDeleteMock = vi.fn();
const cookieGetMock = vi.fn(() => undefined);
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: cookieSetMock,
    delete: cookieDeleteMock,
    get: cookieGetMock,
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

const requireRoleMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  ACTIVE_BUSINESS_COOKIE: "stamply_active_business",
  requireRole: (roles: string[]) => requireRoleMock(roles),
}));

const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

const stripeMock = vi.fn();
vi.mock("@/lib/billing/stripe", () => ({
  stripe: () => stripeMock(),
}));

const captureServerEventMock = vi.fn();
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: (...args: unknown[]) => captureServerEventMock(...args),
}));

import { redirect } from "next/navigation";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/auth/session";
import { deleteBusiness } from "./delete-actions";

// --- Stripe fake -------------------------------------------------------------

function makeFakeStripe() {
  return {
    subscriptions: {
      list: vi.fn(async () => ({ data: [] as unknown[] })),
      cancel: vi.fn(async () => ({})),
    },
  };
}
type FakeStripe = ReturnType<typeof makeFakeStripe>;

function fakeSubscription(overrides: Record<string, unknown> = {}) {
  return { id: "sub_1", status: "active", ...overrides };
}

// --- Storage fake (lives on the ADMIN client — see delete-actions.ts) -------
// `pages` lets tests simulate multi-page `.list()` results; each call
// consumes the next page (sticking on the last one once exhausted, same
// convention as `makeSupabaseMock`).

type StorageObj = { name: string };

function makeFakeStorage(pages: StorageObj[][] = [[]]) {
  let call = 0;
  const list = vi.fn(async (_path: string, _opts: unknown) => {
    const page = pages[Math.min(call, pages.length - 1)];
    call += 1;
    return { data: page, error: null as { message: string } | null };
  });
  const remove = vi.fn(async (_paths: string[]) => ({
    data: null,
    error: null as { message: string } | null,
  }));
  return { list, remove, from: vi.fn(() => ({ list, remove })) };
}
type FakeStorage = ReturnType<typeof makeFakeStorage>;

// --- fixtures ----------------------------------------------------------------

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

let fakeStripe: FakeStripe;
let fakeStorage: FakeStorage;

/** Admin-client mock with both `.from(table)` (via makeSupabaseMock) and `.storage`. */
function makeAdminMock(
  config: Record<string, FakeQueryResult | FakeQueryResult[]>,
  storagePages: StorageObj[][] = [[]],
) {
  const admin = makeSupabaseMock(config);
  fakeStorage = makeFakeStorage(storagePages);
  return Object.assign(admin, { storage: fakeStorage });
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeStripe = makeFakeStripe();
  stripeMock.mockReturnValue(fakeStripe);
});

describe("deleteBusiness", () => {
  it("gates on requireRole(['owner'])", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/dashboard");
    });
    await expect(deleteBusiness({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
    expect(requireRoleMock).toHaveBeenCalledWith(["owner"]);
  });

  it("skips Stripe entirely when there's no stripe_customer_id", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null })),
    );
    const admin = makeAdminMock({
      businesses: { data: null, error: null },
      memberships: { data: [], error: null },
    });
    createAdminClientMock.mockReturnValue(admin);

    await expect(deleteBusiness({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );
    expect(stripeMock).not.toHaveBeenCalled();
  });

  it("cancels live Stripe subscriptions immediately and skips canceled/incomplete_expired ones", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: "cus_1" })),
    );
    fakeStripe.subscriptions.list.mockResolvedValue({
      data: [
        fakeSubscription({ id: "sub_live", status: "active" }),
        fakeSubscription({ id: "sub_old", status: "canceled" }),
        fakeSubscription({ id: "sub_expired", status: "incomplete_expired" }),
      ],
    });
    const admin = makeAdminMock({
      businesses: { data: null, error: null },
      memberships: { data: [], error: null },
    });
    createAdminClientMock.mockReturnValue(admin);

    await expect(deleteBusiness({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );

    expect(fakeStripe.subscriptions.list).toHaveBeenCalledWith({
      customer: "cus_1",
      status: "all",
      limit: 100,
    });
    expect(fakeStripe.subscriptions.cancel).toHaveBeenCalledTimes(1);
    expect(fakeStripe.subscriptions.cancel).toHaveBeenCalledWith("sub_live");
  });

  it("returns an error and stops before the admin client is even created if Stripe cancel fails", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: "cus_1" })),
    );
    fakeStripe.subscriptions.list.mockResolvedValue({
      data: [fakeSubscription({ id: "sub_live", status: "active" })],
    });
    fakeStripe.subscriptions.cancel.mockRejectedValue(
      new Error("stripe unavailable"),
    );

    const state = await deleteBusiness({}, new FormData());

    expect(state.error).toBe(
      "No pudimos detener la facturación de este negocio. Inténtalo de nuevo o contacta a soporte antes de eliminarlo.",
    );
    // The Stripe failure must short-circuit BEFORE createAdminClient() is
    // ever called -- storage cleanup and the business delete both use it.
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("cleans up storage objects under the business's folder via the ADMIN client (not the RLS-scoped one)", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null })),
    );
    const admin = makeAdminMock(
      {
        businesses: { data: null, error: null },
        memberships: { data: [], error: null },
      },
      [[{ name: "logo-abc.png" }, { name: "background-def.png" }]],
    );
    createAdminClientMock.mockReturnValue(admin);

    await expect(deleteBusiness({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );

    expect(fakeStorage.list).toHaveBeenCalledWith("biz-1", {
      limit: 100,
      offset: 0,
    });
    expect(fakeStorage.remove).toHaveBeenCalledWith([
      "biz-1/logo-abc.png",
      "biz-1/background-def.png",
    ]);
  });

  it("paginates through more than one page of storage objects and removes all of them in one call", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null })),
    );
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      name: `asset-${i}.png`,
    }));
    const secondPage = [{ name: "asset-100.png" }];
    const admin = makeAdminMock(
      {
        businesses: { data: null, error: null },
        memberships: { data: [], error: null },
      },
      [firstPage, secondPage],
    );
    createAdminClientMock.mockReturnValue(admin);

    await expect(deleteBusiness({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );

    expect(fakeStorage.list).toHaveBeenCalledTimes(2);
    expect(fakeStorage.list).toHaveBeenNthCalledWith(1, "biz-1", {
      limit: 100,
      offset: 0,
    });
    expect(fakeStorage.list).toHaveBeenNthCalledWith(2, "biz-1", {
      limit: 100,
      offset: 100,
    });
    expect(fakeStorage.remove).toHaveBeenCalledTimes(1);
    const removedPaths = fakeStorage.remove.mock.calls[0][0] as string[];
    expect(removedPaths).toHaveLength(101);
    expect(removedPaths[0]).toBe("biz-1/asset-0.png");
    expect(removedPaths[100]).toBe("biz-1/asset-100.png");
  });

  it("skips calling remove when there are no storage objects", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null })),
    );
    const admin = makeAdminMock({
      businesses: { data: null, error: null },
      memberships: { data: [], error: null },
    });
    createAdminClientMock.mockReturnValue(admin);

    await expect(deleteBusiness({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );

    expect(fakeStorage.remove).not.toHaveBeenCalled();
  });

  it("returns an error and stops before the db delete if storage cleanup fails", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null })),
    );
    const admin = makeAdminMock({ businesses: { data: null, error: null } }, [
      [{ name: "logo-abc.png" }],
    ]);
    fakeStorage.remove.mockResolvedValue({
      data: null,
      error: { message: "storage down" },
    });
    createAdminClientMock.mockReturnValue(admin);

    const state = await deleteBusiness({}, new FormData());

    expect(state.error).toBe(
      "No pudimos eliminar los archivos subidos de este negocio. Inténtalo de nuevo.",
    );
    expect(admin.from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(captureServerEventMock).not.toHaveBeenCalled();
  });

  it("deletes the business row via the admin client", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null })),
    );
    const admin = makeAdminMock({
      businesses: { data: null, error: null },
      memberships: { data: [], error: null },
    });
    createAdminClientMock.mockReturnValue(admin);

    await expect(deleteBusiness({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );

    expect(admin.builderFor("businesses").delete).toHaveBeenCalled();
    expect(admin.builderFor("businesses").eq).toHaveBeenCalledWith(
      "id",
      "biz-1",
    );
  });

  it("captures business_deleted once the business row delete succeeds", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null, plan: "small" })),
    );
    const admin = makeAdminMock({
      businesses: { data: null, error: null },
      memberships: { data: [], error: null },
    });
    createAdminClientMock.mockReturnValue(admin);

    await expect(deleteBusiness({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );

    expect(captureServerEventMock).toHaveBeenCalledTimes(1);
    expect(captureServerEventMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "business_deleted",
      properties: { plan: "small" },
      groups: { business: "biz-1" },
    });
  });

  it("propagates a business-delete DB error as {error} rather than throwing", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null })),
    );
    const admin = makeAdminMock({
      businesses: { data: null, error: { message: "db down" } },
    });
    createAdminClientMock.mockReturnValue(admin);

    const state = await deleteBusiness({}, new FormData());

    expect(state.error).toBe("db down");
    expect(redirect).not.toHaveBeenCalled();
    expect(captureServerEventMock).not.toHaveBeenCalled();
  });

  it("sets the cookie to another membership and redirects to /dashboard when the user has other businesses", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null })),
    );
    const admin = makeAdminMock({
      businesses: { data: null, error: null },
      memberships: {
        data: [{ business_id: "biz-2" }],
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    await expect(deleteBusiness({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );

    expect(cookieSetMock).toHaveBeenCalledWith(
      ACTIVE_BUSINESS_COOKIE,
      "biz-2",
      expect.objectContaining({ path: "/" }),
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("clears the cookie and redirects to /onboarding when the user has no other businesses", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null })),
    );
    const admin = makeAdminMock({
      businesses: { data: null, error: null },
      memberships: { data: [], error: null },
    });
    createAdminClientMock.mockReturnValue(admin);

    await expect(deleteBusiness({}, new FormData())).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding",
    );

    expect(cookieDeleteMock).toHaveBeenCalledWith(ACTIVE_BUSINESS_COOKIE);
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });
});
