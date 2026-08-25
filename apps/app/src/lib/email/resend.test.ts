import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendCtorMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn() };
    constructor(...args: unknown[]) {
      resendCtorMock(...args);
    }
  },
}));

// `@/lib/env` caches its parsed environment in a module-level singleton the
// first time `serverEnv()` runs, so each test that needs a different env
// combination must reset the module registry and re-import fresh.
async function freshResend() {
  vi.resetModules();
  return import("./resend");
}

// `serverEnv()` requires these regardless of what we're testing.
function stubCoreEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getResendClient", () => {
  it("throws requireEnv's error when RESEND_API_KEY isn't set", async () => {
    stubCoreEnv();
    const { getResendClient } = await freshResend();
    expect(() => getResendClient()).toThrow(/Missing RESEND_API_KEY/);
  });

  it("constructs a Resend client with the configured API key", async () => {
    stubCoreEnv();
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    const { getResendClient } = await freshResend();

    const client = getResendClient();

    expect(client).toBeDefined();
    expect(resendCtorMock).toHaveBeenCalledWith("re_test_123");
  });

  it("memoizes the client across calls", async () => {
    stubCoreEnv();
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    const { getResendClient } = await freshResend();

    const a = getResendClient();
    const b = getResendClient();

    expect(a).toBe(b);
    expect(resendCtorMock).toHaveBeenCalledTimes(1);
  });
});

describe("emailFromAddress", () => {
  it("wraps the configured EMAIL_FROM_ADDRESS in a Stamply display name", async () => {
    stubCoreEnv();
    vi.stubEnv("EMAIL_FROM_ADDRESS", "hello@mail.stamplycards.com");
    const { emailFromAddress } = await freshResend();

    expect(emailFromAddress()).toBe("Stamply <hello@mail.stamplycards.com>");
  });

  it("falls back to a default from-address when unset", async () => {
    stubCoreEnv();
    const { emailFromAddress } = await freshResend();

    expect(emailFromAddress()).toMatch(/^Stamply <.+@mail\.stamplycards\.com>$/);
  });
});
