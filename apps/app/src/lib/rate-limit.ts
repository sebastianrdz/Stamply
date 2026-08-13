import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Hard cap on tracked keys: bounds memory even if a caller is handed many
// distinct spoofed keys (e.g. a forged header) in rapid succession — without
// this, `buckets` would grow forever and never shrink.
const MAX_BUCKETS = 10_000;
// Opportunistically prune expired entries every N calls rather than on every
// call (an O(n) sweep per request would itself be a cost center); this still
// bounds worst-case staleness to a small multiple of the sweep interval.
const SWEEP_INTERVAL = 500;

let callsSinceSweep = 0;

function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Best-effort, in-memory, per-instance fixed-window rate limit. NOT a
 * substitute for a shared store in a multi-instance deployment — it resets on
 * cold start and doesn't coordinate across regions/instances. Used as the
 * fallback when Upstash Redis isn't configured (local/dev/CI/tests), and as a
 * safety net if a configured Upstash call fails at runtime.
 *
 * Memory is bounded two ways: expired buckets are swept periodically, and a
 * hard cap evicts the oldest tracked bucket if a genuinely new key arrives
 * while at capacity — so this can't be turned into a slow memory-exhaustion
 * DoS via a flood of distinct/spoofed keys.
 */
function rateLimitInMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  callsSinceSweep += 1;
  if (callsSinceSweep >= SWEEP_INTERVAL) {
    callsSinceSweep = 0;
    sweepExpired(now);
  }

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    if (!bucket && buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) buckets.delete(oldestKey);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

// Resolved once (module-level singleton): `undefined` means "not yet
// resolved", `null` means "resolved to unavailable" (either var is unset).
// Distinguishing the two avoids re-checking env on every call once we know
// Upstash isn't configured.
let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = serverEnv();
  redisClient =
    UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
      ? new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })
      : null;
  return redisClient;
}

// `windowMs` varies per call site, so a single static Ratelimit config can't
// be pre-bound at module scope for every caller. Cache one Ratelimit
// instance per distinct (limit, windowMs) pair instead of constructing a new
// one per call — call volume/variety here is small (a handful of call
// sites), so this stays a tiny map.
const limiters = new Map<string, Ratelimit>();

function getLimiter(redis: Redis, limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

let loggedUpstashFailure = false;

/**
 * Rate limit `key` to `limit` calls per `windowMs`, using Upstash Redis as a
 * shared, cross-instance fixed-window store when
 * `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are configured.
 * Rate limiting must never be a hard dependency for callers (e.g. public
 * enrollment) — falls back to the in-memory limiter both when Upstash isn't
 * configured and, at runtime, if an Upstash call itself fails.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return rateLimitInMemory(key, limit, windowMs);

  try {
    const { success } = await getLimiter(redis, limit, windowMs).limit(key);
    return success;
  } catch (err) {
    if (!loggedUpstashFailure) {
      loggedUpstashFailure = true;
      console.error(
        "[rate-limit] Upstash request failed; falling back to in-memory limiter",
        err,
      );
    }
    return rateLimitInMemory(key, limit, windowMs);
  }
}
