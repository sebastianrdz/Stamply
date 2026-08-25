import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

const cookieGetMock = vi.fn(() => undefined);
const headersGetMock = vi.fn(() => null);
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGetMock })),
  headers: vi.fn(async () => ({ get: headersGetMock })),
}));

const signInWithPasswordMock = vi.fn();
const signOutMock = vi.fn(() => Promise.resolve({ error: null }));
const updateUserMock = vi.fn();
const createClientMock = vi.fn(() =>
  Promise.resolve({
    auth: {
      signInWithPassword: (...args: unknown[]) =>
        signInWithPasswordMock(...args),
      signOut: signOutMock,
      updateUser: (...args: unknown[]) => updateUserMock(...args),
    },
  }),
);
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

const generateLinkMock = vi.fn();
const createAdminClientMock = vi.fn(() => ({
  auth: { admin: { generateLink: (...args: unknown[]) => generateLinkMock(...args) } },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

const sendVerificationEmailMock = vi.fn(
  async (..._args: unknown[]): Promise<{ ok: boolean; error?: string }> => ({
    ok: true,
  }),
);
const sendPasswordResetEmailMock = vi.fn(
  async (..._args: unknown[]): Promise<{ ok: boolean; error?: string }> => ({
    ok: true,
  }),
);
vi.mock("@/lib/email/send", () => ({
  sendVerificationEmail: (...args: unknown[]) =>
    sendVerificationEmailMock(...args),
  sendPasswordResetEmail: (...args: unknown[]) =>
    sendPasswordResetEmailMock(...args),
}));

const rateLimitMock = vi.fn(async (..._args: unknown[]) => true);
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
}));

import { redirect } from "next/navigation";
import {
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from "./actions";

interface EmailCallArg {
  to: string;
  url: string;
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieGetMock.mockReturnValue(undefined);
  headersGetMock.mockReturnValue(null);
  rateLimitMock.mockResolvedValue(true);
  sendVerificationEmailMock.mockResolvedValue({ ok: true });
  sendPasswordResetEmailMock.mockResolvedValue({ ok: true });
});

describe("signIn", () => {
  it("surfaces a validation error for a bad email", async () => {
    const state = await signIn(
      {},
      form({ email: "not-an-email", password: "password123" }),
    );
    expect(state.error).toBe("Ingresa un correo válido.");
  });

  it("returns the supabase error message on failed sign-in", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const state = await signIn(
      {},
      form({ email: "a@b.com", password: "password123" }),
    );
    expect(state.error).toBe("Invalid login credentials");
  });

  it("redirects to `next` (default /dashboard) on success", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    await expect(
      signIn({}, form({ email: "a@b.com", password: "password123" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });
});

describe("signUp", () => {
  it("surfaces a validation error for a short password", async () => {
    const state = await signUp(
      {},
      form({ email: "a@b.com", password: "short" }),
    );
    expect(state.error).toBe("La contraseña debe tener al menos 8 caracteres.");
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  it("returns the supabase error when generateLink fails (e.g. existing user)", async () => {
    generateLinkMock.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    const state = await signUp(
      {},
      form({ email: "a@b.com", password: "password123" }),
    );
    expect(state.error).toBe("User already registered");
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("generates a signup link, sends the verification email, and returns checkEmail:true", async () => {
    generateLinkMock.mockResolvedValue({
      data: { properties: { hashed_token: "hashed-abc" }, user: {} },
      error: null,
    });

    const state = await signUp(
      {},
      form({ email: "New@Example.com", password: "password123" }),
    );

    expect(state).toEqual({ checkEmail: true });
    expect(generateLinkMock).toHaveBeenCalledWith({
      type: "signup",
      email: "New@Example.com",
      password: "password123",
    });
    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
    const arg = sendVerificationEmailMock.mock.calls[0][0] as EmailCallArg;
    expect(arg.to).toBe("New@Example.com");
    expect(arg.url).toContain("token_hash=hashed-abc");
    expect(arg.url).toContain("type=signup");
    expect(arg.url).toContain(`next=${encodeURIComponent("/onboarding")}`);
  });

  it("threads a safe `next` value (e.g. an invite accept link) into the confirm URL", async () => {
    generateLinkMock.mockResolvedValue({
      data: { properties: { hashed_token: "hashed-abc" }, user: {} },
      error: null,
    });

    await signUp(
      {},
      form({
        email: "new@example.com",
        password: "password123",
        next: "/join/tok-1",
      }),
    );

    const url = (sendVerificationEmailMock.mock.calls[0][0] as EmailCallArg)
      .url;
    expect(url).toContain(`next=${encodeURIComponent("/join/tok-1")}`);
  });

  it("ignores an unsafe (open-redirect) `next` value and falls back to /onboarding", async () => {
    generateLinkMock.mockResolvedValue({
      data: { properties: { hashed_token: "hashed-abc" }, user: {} },
      error: null,
    });

    await signUp(
      {},
      form({
        email: "new@example.com",
        password: "password123",
        next: "https://evil.com",
      }),
    );

    const url = (sendVerificationEmailMock.mock.calls[0][0] as EmailCallArg)
      .url;
    expect(url).toContain(`next=${encodeURIComponent("/onboarding")}`);
  });

  it("surfaces an error instead of silently succeeding when the verification email fails to send", async () => {
    generateLinkMock.mockResolvedValue({
      data: { properties: { hashed_token: "hashed-abc" }, user: {} },
      error: null,
    });
    sendVerificationEmailMock.mockResolvedValue({
      ok: false,
      error: "Resend down",
    });

    const state = await signUp(
      {},
      form({ email: "new@example.com", password: "password123" }),
    );

    expect(state.checkEmail).toBeUndefined();
    expect(state.error).toBeTruthy();
  });
});

describe("signOut", () => {
  it("signs out and redirects to /login when called with no destination", async () => {
    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it("redirects to /login?next=<encoded path> for a safe internal path", async () => {
    await expect(signOut("/join/abc")).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fjoin%2Fabc",
    );
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fjoin%2Fabc");
  });

  it("falls back to /login for a protocol-relative URL (open-redirect guard)", async () => {
    await expect(signOut("//evil.com")).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("falls back to /login for an absolute URL (open-redirect guard)", async () => {
    await expect(signOut("https://evil.com")).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
  });
});

describe("requestPasswordReset", () => {
  it("surfaces a validation error for a bad email", async () => {
    const state = await requestPasswordReset({}, form({ email: "not-an-email" }));
    expect(state.error).toBe("Ingresa un correo válido.");
    expect(rateLimitMock).not.toHaveBeenCalled();
  });

  it("returns a rate-limit error and never calls generateLink when rate-limited", async () => {
    rateLimitMock.mockResolvedValue(false);
    const state = await requestPasswordReset({}, form({ email: "a@b.com" }));
    expect(state.error).toBeTruthy();
    expect(state.ok).toBeUndefined();
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  it("sends the reset email and returns ok:true when the account exists", async () => {
    generateLinkMock.mockResolvedValue({
      data: { properties: { hashed_token: "hashed-xyz" }, user: {} },
      error: null,
    });

    const state = await requestPasswordReset(
      {},
      form({ email: "Real@Example.com" }),
    );

    expect(state).toEqual({ ok: true });
    expect(generateLinkMock).toHaveBeenCalledWith({
      type: "recovery",
      email: "real@example.com",
    });
    const arg = sendPasswordResetEmailMock.mock.calls[0][0] as EmailCallArg;
    expect(arg.to).toBe("real@example.com");
    expect(arg.url).toContain("token_hash=hashed-xyz");
    expect(arg.url).toContain("type=recovery");
  });

  it("still returns ok:true (enumeration-safe) when generateLink reports no such user", async () => {
    generateLinkMock.mockResolvedValue({
      data: null,
      error: { message: "User not found" },
    });

    const state = await requestPasswordReset(
      {},
      form({ email: "ghost@example.com" }),
    );

    expect(state).toEqual({ ok: true });
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("still returns ok:true (enumeration-safe) even if generateLink throws", async () => {
    generateLinkMock.mockRejectedValue(new Error("boom"));

    const state = await requestPasswordReset({}, form({ email: "a@b.com" }));

    expect(state).toEqual({ ok: true });
  });

  it("still returns ok:true (enumeration-safe) even if the email send fails", async () => {
    generateLinkMock.mockResolvedValue({
      data: { properties: { hashed_token: "hashed-xyz" }, user: {} },
      error: null,
    });
    sendPasswordResetEmailMock.mockResolvedValue({
      ok: false,
      error: "Resend down",
    });

    const state = await requestPasswordReset({}, form({ email: "a@b.com" }));

    expect(state).toEqual({ ok: true });
  });
});

describe("resetPassword", () => {
  it("returns an error for a too-short password", async () => {
    const state = await resetPassword(
      {},
      form({ password: "short", confirm_password: "short" }),
    );
    expect(state.error).toBeTruthy();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("returns an error when passwords don't match", async () => {
    const state = await resetPassword(
      {},
      form({ password: "password123", confirm_password: "password124" }),
    );
    expect(state.error).toBeTruthy();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("updates the password and returns ok:true on success", async () => {
    updateUserMock.mockResolvedValue({ error: null });

    const state = await resetPassword(
      {},
      form({ password: "password123", confirm_password: "password123" }),
    );

    expect(state).toEqual({ ok: true });
    expect(updateUserMock).toHaveBeenCalledWith({ password: "password123" });
  });

  it("returns the supabase error message on failure", async () => {
    updateUserMock.mockResolvedValue({
      error: { message: "Auth session missing" },
    });

    const state = await resetPassword(
      {},
      form({ password: "password123", confirm_password: "password123" }),
    );

    expect(state.error).toBe("Auth session missing");
  });
});
