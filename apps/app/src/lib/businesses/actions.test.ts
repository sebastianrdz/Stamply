import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";

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

// createBusiness calls `customAlphabet(...)` once at module scope to build
// its slug-suffix generator, so the mock factory (hoisted above these
// `const`s by vitest) needs `slugSuffixMock` available via `vi.hoisted`
// rather than a plain closure over a later-initialized binding.
const { slugSuffixMock } = vi.hoisted(() => ({
  slugSuffixMock: vi.fn(() => "abcde"),
}));
vi.mock("nanoid", () => ({
  customAlphabet: vi.fn(() => slugSuffixMock),
}));

const getUserMock = vi.fn();
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    getUser: (...args: unknown[]) => getUserMock(...args),
  };
});

const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClientMock(...args),
}));

import { redirect } from "next/navigation";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/auth/session";
import { createBusiness } from "./actions";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  slugSuffixMock.mockReturnValue("abcde");
});

describe("createBusiness", () => {
  it("redirects to /login when there's no signed-in user", async () => {
    getUserMock.mockResolvedValue(null);
    await expect(
      createBusiness({}, form({ name: "Bean & Brew" })),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("returns a validation error for a too-short name and never touches the db", async () => {
    getUserMock.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
    });

    const state = await createBusiness({}, form({ name: "a" }));

    expect(state.error).toBe("El nombre del negocio es obligatorio.");
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("returns the membership error and does not redirect when the membership insert fails", async () => {
    getUserMock.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
    });
    const mock = makeSupabaseMock({
      businesses: {
        data: {
          id: "biz-1",
          name: "Bean & Brew",
          slug: "bean-brew-abcde",
          owner_user_id: "user-1",
        },
        error: null,
      },
      memberships: { data: null, error: { message: "insert failed" } },
    });
    createAdminClientMock.mockReturnValue(mock);

    const state = await createBusiness({}, form({ name: "Bean & Brew" }));

    expect(state.error).toBe("insert failed");
    expect(redirect).not.toHaveBeenCalled();
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("on success: inserts the business, inserts the owner membership, sets the active-business cookie, and redirects", async () => {
    getUserMock.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
    });
    const mock = makeSupabaseMock({
      businesses: {
        data: {
          id: "biz-1",
          name: "Bean & Brew",
          slug: "bean-brew-abcde",
          owner_user_id: "user-1",
        },
        error: null,
      },
      memberships: { data: null, error: null },
    });
    createAdminClientMock.mockReturnValue(mock);

    await expect(
      createBusiness({}, form({ name: "Bean & Brew" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    const businessInsert =
      mock.builderFor("businesses").insert.mock.calls[0][0];
    expect(businessInsert).toEqual(
      expect.objectContaining({
        name: "Bean & Brew",
        slug: "bean-brew-abcde",
        owner_user_id: "user-1",
      }),
    );

    const membershipInsert =
      mock.builderFor("memberships").insert.mock.calls[0][0];
    expect(membershipInsert).toEqual(
      expect.objectContaining({
        business_id: "biz-1",
        user_id: "user-1",
        role: "owner",
      }),
    );

    expect(cookieSetMock).toHaveBeenCalledWith(
      ACTIVE_BUSINESS_COOKIE,
      "biz-1",
      expect.objectContaining({ path: "/" }),
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
