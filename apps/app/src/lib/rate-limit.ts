import "server-only";

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
 * substitute for a shared store (Upstash/Vercel KV) in a multi-instance
 * deployment — it resets on cold start and doesn't coordinate across
 * regions/instances. Acceptable as a stopgap abuse guard without adding a
 * new dependency; revisit with a shared store before scaling horizontally.
 *
 * Memory is bounded two ways: expired buckets are swept periodically, and a
 * hard cap evicts the oldest tracked bucket if a genuinely new key arrives
 * while at capacity — so this can't be turned into a slow memory-exhaustion
 * DoS via a flood of distinct/spoofed keys.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
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
