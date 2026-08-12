import { afterEach, describe, expect, it, vi } from "vitest";

// `@/lib/env` caches its parsed environment in a module-level singleton the
// first time `serverEnv()` runs, so each test that needs a different env
// combination must reset the module registry and re-import fresh.
async function freshRateLimit() {
  vi.resetModules();
  return import("./rate-limit");
}

// `serverEnv()` requires these regardless of what we're testing.
function stubCoreEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@upstash/ratelimit");
  vi.doUnmock("@upstash/redis");
});

describe("rateLimit — in-memory fallback (no Upstash env configured)", () => {
  it("allows up to `limit` calls in the window, then rejects", async () => {
    stubCoreEnv();
    const { rateLimit } = await freshRateLimit();

    const key = "fallback:allow-then-reject";
    expect(await rateLimit(key, 3, 60_000)).toBe(true);
    expect(await rateLimit(key, 3, 60_000)).toBe(true);
    expect(await rateLimit(key, 3, 60_000)).toBe(true);
    expect(await rateLimit(key, 3, 60_000)).toBe(false);
    expect(await rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("tracks distinct keys independently", async () => {
    stubCoreEnv();
    const { rateLimit } = await freshRateLimit();

    expect(await rateLimit("fallback:key-a", 1, 60_000)).toBe(true);
    expect(await rateLimit("fallback:key-a", 1, 60_000)).toBe(false);
    // A different key has its own budget, unaffected by key-a's rejection.
    expect(await rateLimit("fallback:key-b", 1, 60_000)).toBe(true);
  });

  it("resets the window once it has elapsed", async () => {
    stubCoreEnv();
    vi.useFakeTimers();
    try {
      const { rateLimit } = await freshRateLimit();
      const key = "fallback:window-reset";

      expect(await rateLimit(key, 1, 1_000)).toBe(true);
      expect(await rateLimit(key, 1, 1_000)).toBe(false);

      vi.advanceTimersByTime(1_001);

      expect(await rateLimit(key, 1, 1_000)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("rateLimit — Upstash-backed (env configured)", () => {
  it("returns true when Upstash allows the request", async () => {
    stubCoreEnv();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

    const limitMock = vi.fn(async () => ({ success: true }));
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn().mockImplementation(() => ({})),
    }));
    vi.doMock("@upstash/ratelimit", () => {
      class FakeRatelimit {
        limit = limitMock;
        static fixedWindow = vi.fn((tokens: number, window: string) => ({
          tokens,
          window,
        }));
      }
      return { Ratelimit: FakeRatelimit };
    });

    const { rateLimit } = await freshRateLimit();
    const result = await rateLimit("upstash:allowed", 5, 60_000);

    expect(result).toBe(true);
    expect(limitMock).toHaveBeenCalledWith("upstash:allowed");
  });

  it("returns false when Upstash rejects the request", async () => {
    stubCoreEnv();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

    const limitMock = vi.fn(async () => ({ success: false }));
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn().mockImplementation(() => ({})),
    }));
    vi.doMock("@upstash/ratelimit", () => {
      class FakeRatelimit {
        limit = limitMock;
        static fixedWindow = vi.fn((tokens: number, window: string) => ({
          tokens,
          window,
        }));
      }
      return { Ratelimit: FakeRatelimit };
    });

    const { rateLimit } = await freshRateLimit();
    const result = await rateLimit("upstash:rejected", 5, 60_000);

    expect(result).toBe(false);
  });

  it("falls back to the in-memory limiter when the Upstash call throws", async () => {
    stubCoreEnv();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

    const limitMock = vi.fn(async () => {
      throw new Error("network boom");
    });
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn().mockImplementation(() => ({})),
    }));
    vi.doMock("@upstash/ratelimit", () => {
      class FakeRatelimit {
        limit = limitMock;
        static fixedWindow = vi.fn((tokens: number, window: string) => ({
          tokens,
          window,
        }));
      }
      return { Ratelimit: FakeRatelimit };
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { rateLimit } = await freshRateLimit();
    const key = "upstash:network-failure";

    // Upstash throws every call, so this exercises the in-memory fallback's
    // own fixed-window accounting (limit of 1).
    expect(await rateLimit(key, 1, 60_000)).toBe(true);
    expect(await rateLimit(key, 1, 60_000)).toBe(false);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
