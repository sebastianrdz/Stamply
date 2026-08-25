import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

const verifyOtpMock = vi.fn();
const createClientMock = vi.fn(() =>
  Promise.resolve({ auth: { verifyOtp: verifyOtpMock } }),
);
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

import { redirect } from "next/navigation";
import { GET } from "./route";

function requestFor(query: string): NextRequest {
  return new NextRequest(`https://app.stamply.test/auth/confirm${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/confirm", () => {
  it("verifies the OTP and redirects to `next` on success", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });

    await expect(
      GET(requestFor("?token_hash=abc123&type=signup&next=%2Fjoin%2Ftok-1")),
    ).rejects.toThrow("NEXT_REDIRECT:/join/tok-1");

    expect(verifyOtpMock).toHaveBeenCalledWith({
      type: "signup",
      token_hash: "abc123",
    });
    expect(redirect).toHaveBeenCalledWith("/join/tok-1");
  });

  it("defaults to /dashboard when `next` is omitted", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });

    await expect(
      GET(requestFor("?token_hash=abc123&type=recovery")),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects to /login?error=invalid_link when verifyOtp fails", async () => {
    verifyOtpMock.mockResolvedValue({
      error: { message: "Token has expired or is invalid" },
    });

    await expect(
      GET(requestFor("?token_hash=bad&type=signup")),
    ).rejects.toThrow("NEXT_REDIRECT:/login?error=invalid_link");
  });

  it("redirects to /login?error=invalid_link when token_hash or type is missing", async () => {
    await expect(GET(requestFor("?type=signup"))).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=invalid_link",
    );
    expect(verifyOtpMock).not.toHaveBeenCalled();

    await expect(GET(requestFor("?token_hash=abc123"))).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=invalid_link",
    );
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });
});
