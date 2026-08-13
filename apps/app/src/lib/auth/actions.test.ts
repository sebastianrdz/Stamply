import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

const signOutMock = vi.fn(() => Promise.resolve({ error: null }));
const createClientMock = vi.fn(() =>
  Promise.resolve({ auth: { signOut: signOutMock } }),
);
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

import { redirect } from "next/navigation";
import { signOut } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
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
