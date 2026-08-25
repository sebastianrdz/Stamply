import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSendMock = vi.fn();
const resendCtorMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => resendSendMock(...args) };
    constructor(...args: unknown[]) {
      resendCtorMock(...args);
    }
  },
}));

// `@/lib/env` caches its parsed environment in a module-level singleton the
// first time `serverEnv()` runs, so each test that needs a different env
// combination must reset the module registry and re-import fresh.
async function freshSend() {
  vi.resetModules();
  return import("./send");
}

function stubCoreEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("RESEND_API_KEY", "re_test_123");
  vi.stubEnv("EMAIL_FROM_ADDRESS", "notifications@mail.stamplycards.com");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendTeamInviteEmail", () => {
  it("sends with the correct to/from/subject", async () => {
    stubCoreEnv();
    resendSendMock.mockResolvedValue({ data: { id: "email_1" }, error: null });
    const { sendTeamInviteEmail } = await freshSend();

    const result = await sendTeamInviteEmail({
      to: "new@example.com",
      businessName: "The Coffee Spot",
      role: "employee",
      url: "https://app.stamply.test/join/tok-123",
      locale: "es",
    });

    expect(result).toEqual({ ok: true });
    expect(resendSendMock).toHaveBeenCalledTimes(1);
    const arg = resendSendMock.mock.calls[0][0];
    expect(arg.to).toBe("new@example.com");
    expect(arg.from).toBe("Stamply <notifications@mail.stamplycards.com>");
    expect(arg.subject).toContain("The Coffee Spot");
    expect(arg.react).toBeTruthy();
  });

  it("resolves { ok: false } instead of throwing when Resend reports an error", async () => {
    stubCoreEnv();
    resendSendMock.mockResolvedValue({
      data: null,
      error: { message: "invalid domain" },
    });
    const { sendTeamInviteEmail } = await freshSend();

    const result = await sendTeamInviteEmail({
      to: "new@example.com",
      businessName: "The Coffee Spot",
      role: "employee",
      url: "https://app.stamply.test/join/tok-123",
      locale: "es",
    });

    expect(result).toEqual({ ok: false, error: "invalid domain" });
  });

  it("resolves { ok: false } instead of throwing when the send call throws", async () => {
    stubCoreEnv();
    resendSendMock.mockRejectedValue(new Error("network down"));
    const { sendTeamInviteEmail } = await freshSend();

    const result = await sendTeamInviteEmail({
      to: "new@example.com",
      businessName: "The Coffee Spot",
      role: "employee",
      url: "https://app.stamply.test/join/tok-123",
      locale: "es",
    });

    expect(result).toEqual({ ok: false, error: "network down" });
  });
});

describe("sendVerificationEmail", () => {
  it("sends the confirm-email link with the correct to/subject", async () => {
    stubCoreEnv();
    resendSendMock.mockResolvedValue({ data: { id: "email_2" }, error: null });
    const { sendVerificationEmail } = await freshSend();

    const result = await sendVerificationEmail({
      to: "person@example.com",
      url: "https://app.stamply.test/auth/confirm?token_hash=abc&type=signup",
      locale: "en",
    });

    expect(result).toEqual({ ok: true });
    const arg = resendSendMock.mock.calls[0][0];
    expect(arg.to).toBe("person@example.com");
    expect(arg.from).toBe("Stamply <notifications@mail.stamplycards.com>");
    expect(typeof arg.subject).toBe("string");
    expect(arg.subject.length).toBeGreaterThan(0);
  });

  it("resolves { ok: false } instead of throwing on failure", async () => {
    stubCoreEnv();
    resendSendMock.mockResolvedValue({
      data: null,
      error: { message: "rejected" },
    });
    const { sendVerificationEmail } = await freshSend();

    const result = await sendVerificationEmail({
      to: "person@example.com",
      url: "https://app.stamply.test/auth/confirm?token_hash=abc&type=signup",
      locale: "en",
    });

    expect(result).toEqual({ ok: false, error: "rejected" });
  });
});

describe("sendPasswordResetEmail", () => {
  it("sends the reset link with the correct to/subject", async () => {
    stubCoreEnv();
    resendSendMock.mockResolvedValue({ data: { id: "email_3" }, error: null });
    const { sendPasswordResetEmail } = await freshSend();

    const result = await sendPasswordResetEmail({
      to: "person@example.com",
      url: "https://app.stamply.test/auth/confirm?token_hash=xyz&type=recovery&next=/reset-password",
      locale: "es",
    });

    expect(result).toEqual({ ok: true });
    const arg = resendSendMock.mock.calls[0][0];
    expect(arg.to).toBe("person@example.com");
    expect(arg.from).toBe("Stamply <notifications@mail.stamplycards.com>");
  });

  it("resolves { ok: false } instead of throwing when the send call throws", async () => {
    stubCoreEnv();
    resendSendMock.mockRejectedValue(new Error("timeout"));
    const { sendPasswordResetEmail } = await freshSend();

    const result = await sendPasswordResetEmail({
      to: "person@example.com",
      url: "https://app.stamply.test/auth/confirm?token_hash=xyz&type=recovery&next=/reset-password",
      locale: "es",
    });

    expect(result).toEqual({ ok: false, error: "timeout" });
  });
});
