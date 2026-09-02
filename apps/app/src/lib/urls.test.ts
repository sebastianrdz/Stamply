import { afterEach, describe, expect, it, vi } from "vitest";
import { cardUrl, enrollUrl, privacyUrl, termsUrl } from "./urls";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("enrollUrl", () => {
  it("defaults to http://localhost:3000 when NEXT_PUBLIC_APP_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
    expect(enrollUrl("prog-1")).toBe("http://localhost:3000/c/join/prog-1");
  });

  it("uses NEXT_PUBLIC_APP_URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stamply.example");
    expect(enrollUrl("prog-1")).toBe(
      "https://stamply.example/c/join/prog-1",
    );
  });

  it("strips a trailing slash so the URL is never double-slashed", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stamply.example/");
    expect(enrollUrl("prog-1")).toBe(
      "https://stamply.example/c/join/prog-1",
    );
  });
});

describe("cardUrl", () => {
  it("defaults to http://localhost:3000 when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
    expect(cardUrl("tok_abc")).toBe("http://localhost:3000/c/tok_abc");
  });

  it("uses the configured base URL with a trailing slash stripped", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stamply.example/");
    expect(cardUrl("tok_abc")).toBe("https://stamply.example/c/tok_abc");
  });

  it("uses the configured base URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stamply.example");
    expect(cardUrl("tok_abc")).toBe("https://stamply.example/c/tok_abc");
  });
});

describe("termsUrl", () => {
  it("defaults to http://localhost:3001 when NEXT_PUBLIC_MARKETING_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", undefined);
    expect(termsUrl()).toBe("http://localhost:3001/terms");
  });

  it("uses NEXT_PUBLIC_MARKETING_URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "https://stamply.example");
    expect(termsUrl()).toBe("https://stamply.example/terms");
  });

  it("strips a trailing slash so the URL is never double-slashed", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "https://stamply.example/");
    expect(termsUrl()).toBe("https://stamply.example/terms");
  });
});

describe("privacyUrl", () => {
  it("defaults to http://localhost:3001 when NEXT_PUBLIC_MARKETING_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", undefined);
    expect(privacyUrl()).toBe("http://localhost:3001/privacy");
  });

  it("uses NEXT_PUBLIC_MARKETING_URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "https://stamply.example");
    expect(privacyUrl()).toBe("https://stamply.example/privacy");
  });

  it("strips a trailing slash so the URL is never double-slashed", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "https://stamply.example/");
    expect(privacyUrl()).toBe("https://stamply.example/privacy");
  });
});
