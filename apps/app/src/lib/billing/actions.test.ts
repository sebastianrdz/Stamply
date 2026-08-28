import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseMock } from "@/lib/test-utils/supabase-mock";
import type { Business, MembershipRole } from "@/types/database";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

const requireRoleMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireRole: (roles: string[]) => requireRoleMock(roles),
}));

const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

const appUrlBaseMock = vi.fn(
  (..._args: unknown[]) => "https://app.stamply.test",
);
vi.mock("@/lib/wallet/shared", () => ({
  appUrlBase: () => appUrlBaseMock(),
}));

const stripeMock = vi.fn();
const priceIdForPlanMock = vi.fn(
  (..._args: unknown[]) => "price_placeholder_123",
);
vi.mock("./stripe", () => ({
  stripe: () => stripeMock(),
  priceIdForPlan: (tier: string, interval?: string) =>
    priceIdForPlanMock(tier, interval),
}));

const captureServerEventMock = vi.fn();
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: (...args: unknown[]) => captureServerEventMock(...args),
}));

import { redirect } from "next/navigation";
import { changePlan, openBillingPortal } from "./actions";

// --- Stripe fake -----------------------------------------------------------

function makeFakeStripe() {
  return {
    customers: {
      search: vi.fn(async () => ({ data: [] as Array<{ id: string }> })),
      create: vi.fn(async () => ({ id: "cus_new" })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: [] as unknown[] })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({
          url: "https://checkout.stripe.com/session_1",
        })),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(async () => ({
          url: "https://billing.stripe.com/portal_session",
        })),
      },
    },
  };
}
type FakeStripe = ReturnType<typeof makeFakeStripe>;

function fakeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    // A price id that differs from any test's target tier, so the same-price
    // short-circuit in changePlan does NOT fire unless a test opts in.
    items: { data: [{ id: "si_1", price: { id: "price_current_abc" } }] },
    ...overrides,
  };
}

// --- fixtures ---------------------------------------------------------------

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

beforeEach(() => {
  vi.clearAllMocks();
  fakeStripe = makeFakeStripe();
  stripeMock.mockReturnValue(fakeStripe);
  priceIdForPlanMock.mockImplementation(
    (...args: unknown[]) => `price_${args[0]}_123`,
  );
  appUrlBaseMock.mockReturnValue("https://app.stamply.test");
});

describe("changePlan", () => {
  it("gates on requireRole(['owner'])", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/dashboard");
    });
    await expect(changePlan("medium")).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
    expect(requireRoleMock).toHaveBeenCalledWith(["owner"]);
  });

  describe("no live subscription", () => {
    it("creates a Checkout session for a business that never subscribed, and does not touch the Billing Portal", async () => {
      const biz = business({ stripe_customer_id: null });
      requireRoleMock.mockResolvedValue(ctx("owner", biz));
      const admin = makeSupabaseMock({
        businesses: { data: null, error: null },
      });
      createAdminClientMock.mockReturnValue(admin);
      fakeStripe.customers.search.mockResolvedValue({ data: [] });
      fakeStripe.customers.create.mockResolvedValue({ id: "cus_new" });
      fakeStripe.subscriptions.list.mockResolvedValue({ data: [] });

      await expect(changePlan("medium")).rejects.toThrow(
        "NEXT_REDIRECT:https://checkout.stripe.com/session_1",
      );

      expect(fakeStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "owner@example.com",
          name: "The Coffee Spot",
          metadata: { business_id: "biz-1" },
        }),
      );
      const businessUpdate =
        admin.builderFor("businesses").update.mock.calls[0][0];
      expect(businessUpdate).toEqual({ stripe_customer_id: "cus_new" });

      expect(fakeStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          customer: "cus_new",
          line_items: [{ price: "price_medium_123", quantity: 1 }],
          allow_promotion_codes: true,
        }),
      );
      // Defaults to monthly billing when no interval is passed.
      expect(priceIdForPlanMock).toHaveBeenCalledWith("medium", "month");
      expect(fakeStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
      expect(captureServerEventMock).toHaveBeenCalledWith({
        distinctId: "user-1",
        event: "checkout_started",
        properties: { tier: "medium", interval: "month" },
        groups: { business: "biz-1" },
      });
    });

    it("creates a Checkout session when the customer's only subscriptions are canceled (reactivation)", async () => {
      const biz = business({ stripe_customer_id: "cus_existing" });
      requireRoleMock.mockResolvedValue(ctx("owner", biz));
      fakeStripe.subscriptions.list.mockResolvedValue({
        data: [fakeSubscription({ status: "canceled" })],
      });

      await expect(changePlan("small")).rejects.toThrow(
        "NEXT_REDIRECT:https://checkout.stripe.com/session_1",
      );

      expect(fakeStripe.subscriptions.list).toHaveBeenCalledWith({
        customer: "cus_existing",
        status: "all",
        limit: 100,
      });
      expect(fakeStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_existing" }),
      );
      expect(fakeStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });

    it("self-heals a previously-orphaned Stripe customer found by metadata instead of creating a duplicate", async () => {
      const biz = business({ stripe_customer_id: null });
      requireRoleMock.mockResolvedValue(ctx("owner", biz));
      const admin = makeSupabaseMock({
        businesses: { data: null, error: null },
      });
      createAdminClientMock.mockReturnValue(admin);
      fakeStripe.customers.search.mockResolvedValue({
        data: [{ id: "cus_found" }],
      });

      await expect(changePlan("small")).rejects.toThrow("NEXT_REDIRECT:");

      expect(fakeStripe.customers.create).not.toHaveBeenCalled();
      const businessUpdate =
        admin.builderFor("businesses").update.mock.calls[0][0];
      expect(businessUpdate).toEqual({ stripe_customer_id: "cus_found" });
      expect(fakeStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_found" }),
      );
    });
  });

  describe("live subscription exists — the double-payment invariant", () => {
    it.each(["active", "trialing", "past_due", "unpaid", "incomplete"])(
      "opens a Billing Portal plan-change session for a %s subscription and never creates a Checkout session",
      async (status) => {
        const biz = business({ stripe_customer_id: "cus_existing" });
        requireRoleMock.mockResolvedValue(ctx("owner", biz));
        fakeStripe.subscriptions.list.mockResolvedValue({
          data: [fakeSubscription({ id: "sub_live", status })],
        });

        await expect(changePlan("medium")).rejects.toThrow(
          "NEXT_REDIRECT:https://billing.stripe.com/portal_session",
        );

        expect(fakeStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            customer: "cus_existing",
            flow_data: {
              type: "subscription_update_confirm",
              subscription_update_confirm: {
                subscription: "sub_live",
                items: [{ id: "si_1", price: "price_medium_123", quantity: 1 }],
              },
            },
          }),
        );
        expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled();
        // Portal-based plan changes are not a new Checkout, so no
        // checkout_started event.
        expect(captureServerEventMock).not.toHaveBeenCalled();
      },
    );

    it("never calls checkout.sessions.create when a live subscription is present, even implicitly", async () => {
      const biz = business({ stripe_customer_id: "cus_existing" });
      requireRoleMock.mockResolvedValue(ctx("owner", biz));
      fakeStripe.subscriptions.list.mockResolvedValue({
        data: [fakeSubscription({ status: "active" })],
      });

      await expect(changePlan("big")).rejects.toThrow("NEXT_REDIRECT:");

      expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(fakeStripe.billingPortal.sessions.create).toHaveBeenCalledTimes(1);
    });

    it("ignores canceled/incomplete_expired subscriptions and only treats live ones as blocking", async () => {
      const biz = business({ stripe_customer_id: "cus_existing" });
      requireRoleMock.mockResolvedValue(ctx("owner", biz));
      fakeStripe.subscriptions.list.mockResolvedValue({
        data: [
          fakeSubscription({ id: "sub_old", status: "canceled" }),
          fakeSubscription({ id: "sub_expired", status: "incomplete_expired" }),
          fakeSubscription({ id: "sub_live", status: "active" }),
        ],
      });

      await expect(changePlan("medium")).rejects.toThrow(
        "NEXT_REDIRECT:https://billing.stripe.com/portal_session",
      );

      expect(fakeStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          flow_data: expect.objectContaining({
            subscription_update_confirm: expect.objectContaining({
              subscription: "sub_live",
            }),
          }),
        }),
      );
    });

    it("short-circuits a no-op switch to the tier the subscription is already on, without calling Stripe or double-charging", async () => {
      const biz = business({ stripe_customer_id: "cus_existing" });
      requireRoleMock.mockResolvedValue(ctx("owner", biz));
      // The live subscription's item is already on the target tier's price.
      fakeStripe.subscriptions.list.mockResolvedValue({
        data: [
          fakeSubscription({
            id: "sub_live",
            status: "active",
            items: {
              data: [{ id: "si_1", price: { id: "price_medium_123" } }],
            },
          }),
        ],
      });

      await expect(changePlan("medium")).rejects.toThrow(
        "NEXT_REDIRECT:https://app.stamply.test/dashboard/billing?status=nochange",
      );

      expect(fakeStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
      expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(captureServerEventMock).not.toHaveBeenCalled();
    });

    it("fails safe: if listing subscriptions throws, no Checkout session is created (never opens a double-charge path)", async () => {
      const biz = business({ stripe_customer_id: "cus_existing" });
      requireRoleMock.mockResolvedValue(ctx("owner", biz));
      fakeStripe.subscriptions.list.mockRejectedValue(
        new Error("stripe unavailable"),
      );

      await expect(changePlan("medium")).rejects.toThrow("stripe unavailable");

      expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(fakeStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });
  });

  describe("Stripe customer persist failure", () => {
    it("throws and never creates a Checkout session (or a subscription) when the businesses.update persist fails", async () => {
      const biz = business({ stripe_customer_id: null });
      requireRoleMock.mockResolvedValue(ctx("owner", biz));
      const admin = makeSupabaseMock({
        businesses: { data: null, error: { message: "db down" } },
      });
      createAdminClientMock.mockReturnValue(admin);
      fakeStripe.customers.search.mockResolvedValue({ data: [] });
      fakeStripe.customers.create.mockResolvedValue({ id: "cus_new" });

      await expect(changePlan("medium")).rejects.toThrow(/db down/);

      expect(fakeStripe.subscriptions.list).not.toHaveBeenCalled();
      expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(fakeStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });
  });
});

describe("openBillingPortal", () => {
  it("redirects to /dashboard/billing without calling Stripe when there is no customer id", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: null })),
    );

    await expect(openBillingPortal()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/billing",
    );
    expect(fakeStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("opens a generic Billing Portal session and redirects to it", async () => {
    requireRoleMock.mockResolvedValue(
      ctx("owner", business({ stripe_customer_id: "cus_existing" })),
    );

    await expect(openBillingPortal()).rejects.toThrow(
      "NEXT_REDIRECT:https://billing.stripe.com/portal_session",
    );
    expect(fakeStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "https://app.stamply.test/dashboard/billing",
    });
  });
});
