import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import type { Business, Program } from "@/types/database";

const headersGetMock = vi.fn(() => null);
const cookieGetMock = vi.fn(() => undefined);
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: headersGetMock })),
  cookies: vi.fn(async () => ({ get: cookieGetMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

const rateLimitMock = vi.fn((..._args: unknown[]) => true);
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
}));

const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
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

const issueCardMock = vi.fn();
vi.mock("@/lib/cards/issue", () => ({
  issueCard: (...args: unknown[]) => issueCardMock(...args),
}));

const captureServerEventMock = vi.fn();
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: (...args: unknown[]) => captureServerEventMock(...args),
}));

import { redirect } from "next/navigation";
import { LimitExceededError } from "@/lib/billing/entitlements";
import { enroll } from "./actions";

const PROGRAM_ID = "11111111-1111-4111-8111-111111111111";

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

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: PROGRAM_ID,
    business_id: "biz-1",
    name: "Coffee Punch Card",
    type: "stamp",
    goal: 10,
    reward_description: "A free coffee",
    active: true,
    design: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const baseFields = {
  program_id: PROGRAM_ID,
  full_name: "Jane Doe",
  email: "jane@example.com",
  phone: "",
  birthday: "1990-05-15",
};

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockReturnValue(true);
  headersGetMock.mockReturnValue(null);
  assertWithinLimitMock.mockResolvedValue(undefined);
});

describe("enroll — validation", () => {
  it("surfaces the zod message for an invalid email", async () => {
    const state = await enroll(
      {},
      form({ ...baseFields, email: "not-an-email" }),
    );
    expect(state.error).toBe("Ingresa un correo válido.");
  });

  it("surfaces the zod message for a missing name", async () => {
    const state = await enroll({}, form({ ...baseFields, full_name: "" }));
    expect(state.error).toBe("Ingresa tu nombre.");
  });

  it("surfaces the zod message for a missing birthday", async () => {
    const state = await enroll({}, form({ ...baseFields, birthday: "" }));
    expect(state.error).toBe("Ingresa tu fecha de nacimiento.");
  });
});

describe("enroll — rate limiting", () => {
  it("returns a friendly error when rate-limited", async () => {
    rateLimitMock.mockReturnValue(false);
    const state = await enroll({}, form(baseFields));
    expect(state.error).toBe(
      "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
    );
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });
});

describe("enroll — program lookup", () => {
  it("returns an error when the program isn't found", async () => {
    createAdminClientMock.mockReturnValue(
      makeSupabaseMock({ programs: { data: null } }),
    );
    const state = await enroll({}, form(baseFields));
    expect(state.error).toBe("No se encontró este programa de lealtad.");
  });

  it("returns an error when the program is inactive", async () => {
    createAdminClientMock.mockReturnValue(
      makeSupabaseMock({
        programs: {
          data: { ...program({ active: false }), business: business() },
        },
      }),
    );
    const state = await enroll({}, form(baseFields));
    expect(state.error).toBe(
      "Este programa no está aceptando nuevos miembros por ahora.",
    );
  });
});

describe("enroll — existing customer", () => {
  it("reuses an existing customer by email, skipping the limit check and insert", async () => {
    const mock = makeSupabaseMock({
      programs: { data: { ...program(), business: business() } },
      customers: [{ data: { id: "existing-cust" } }],
    });
    createAdminClientMock.mockReturnValue(mock);
    issueCardMock.mockResolvedValue({
      id: "card-1",
      pass_auth_token: "tok_123",
    });

    await expect(enroll({}, form(baseFields))).rejects.toThrow(
      "NEXT_REDIRECT:/c/tok_123",
    );

    expect(assertWithinLimitMock).not.toHaveBeenCalled();
    // The existence lookup plus the best-effort birthday backfill touch
    // "customers" — no insert.
    expect(mock.callCounts.customers).toBe(2);
    expect(issueCardMock).toHaveBeenCalledWith(
      mock,
      expect.objectContaining({ customerId: "existing-cust" }),
    );
    expect(redirect).toHaveBeenCalledWith("/c/tok_123");
    expect(captureServerEventMock).toHaveBeenCalledWith({
      distinctId: "existing-cust",
      event: "customer_enrolled",
      properties: {
        program_id: PROGRAM_ID,
        program_type: "stamp",
        is_new_customer: false,
      },
      groups: { business: "biz-1" },
    });
  });

  it("redirects to the existing card without issuing a duplicate when already enrolled in this program", async () => {
    const mock = makeSupabaseMock({
      programs: { data: { ...program(), business: business() } },
      customers: [{ data: { id: "existing-cust" } }],
      cards: { data: { pass_auth_token: "tok_existing" } },
    });
    createAdminClientMock.mockReturnValue(mock);

    await expect(enroll({}, form(baseFields))).rejects.toThrow(
      "NEXT_REDIRECT:/c/tok_existing",
    );

    // No new card is issued for a duplicate enrollment.
    expect(issueCardMock).not.toHaveBeenCalled();
    const cardsBuilder = mock.builderFor("cards");
    expect(cardsBuilder.eq).toHaveBeenCalledWith("program_id", PROGRAM_ID);
    expect(cardsBuilder.eq).toHaveBeenCalledWith(
      "customer_id",
      "existing-cust",
    );
    expect(redirect).toHaveBeenCalledWith("/c/tok_existing");
    // Already had a card in this program — not a (re-)enrollment.
    expect(captureServerEventMock).not.toHaveBeenCalled();
  });
});

describe("enroll — new customer", () => {
  it("returns a friendly limit-exceeded message when the business is at capacity", async () => {
    const mock = makeSupabaseMock({
      programs: { data: { ...program(), business: business() } },
      customers: [{ data: null }], // no existing match
    });
    createAdminClientMock.mockReturnValue(mock);
    assertWithinLimitMock.mockRejectedValue(
      new LimitExceededError("customers", "small", 100),
    );

    const state = await enroll({}, form(baseFields));
    expect(state.error).toBe("Este negocio alcanzó su límite de clientes.");
    expect(mock.callCounts.customers).toBe(1); // never reached the insert
  });

  it("propagates non-LimitExceededError errors from assertWithinLimit", async () => {
    const mock = makeSupabaseMock({
      programs: { data: { ...program(), business: business() } },
      customers: [{ data: null }],
    });
    createAdminClientMock.mockReturnValue(mock);
    assertWithinLimitMock.mockRejectedValue(new Error("db exploded"));

    await expect(enroll({}, form(baseFields))).rejects.toThrow("db exploded");
  });

  it("creates the customer and issues a card, then redirects to the card page", async () => {
    const mock = makeSupabaseMock({
      programs: { data: { ...program(), business: business() } },
      customers: [{ data: null }, { data: { id: "new-cust" }, error: null }],
    });
    createAdminClientMock.mockReturnValue(mock);
    issueCardMock.mockResolvedValue({
      id: "card-2",
      pass_auth_token: "tok_new",
    });

    await expect(enroll({}, form(baseFields))).rejects.toThrow(
      "NEXT_REDIRECT:/c/tok_new",
    );

    expect(assertWithinLimitMock).toHaveBeenCalledWith(
      mock,
      expect.objectContaining({ id: "biz-1" }),
      "customers",
    );
    expect(issueCardMock).toHaveBeenCalledWith(
      mock,
      expect.objectContaining({ customerId: "new-cust" }),
    );
    expect(redirect).toHaveBeenCalledWith("/c/tok_new");
    expect(captureServerEventMock).toHaveBeenCalledWith({
      distinctId: "new-cust",
      event: "customer_enrolled",
      properties: {
        program_id: PROGRAM_ID,
        program_type: "stamp",
        is_new_customer: true,
      },
      groups: { business: "biz-1" },
    });
  });

  it("returns the db error message when the customer insert fails", async () => {
    const mock = makeSupabaseMock({
      programs: { data: { ...program(), business: business() } },
      customers: [
        { data: null },
        { data: null, error: { message: "insert boom" } },
      ],
    });
    createAdminClientMock.mockReturnValue(mock);

    const state = await enroll({}, form(baseFields));
    expect(state.error).toBe("insert boom");
    expect(issueCardMock).not.toHaveBeenCalled();
    expect(captureServerEventMock).not.toHaveBeenCalled();
  });
});
