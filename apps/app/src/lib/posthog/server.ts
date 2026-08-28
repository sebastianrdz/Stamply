import "server-only";

import { PostHog } from "posthog-node";
import { after } from "next/server";
import { serverEnv } from "@/lib/env";

/**
 * Lazily-constructed singleton posthog-node client, reused across warm
 * serverless invocations. Never constructed at module load — only on first
 * real use — so builds and cold starts without a configured key pay no cost.
 */
let client: PostHog | null = null;

function getClient(): PostHog | null {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!client) {
    client = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.POSTHOG_HOST,
      flushAt: 1,
    });
  }
  return client;
}

/**
 * Fire-and-forget server-side event capture. Never throws into caller code —
 * a missing key or a capture failure is swallowed (and logged). Flushing is
 * deferred to `after()` so it never blocks the response; the client is a
 * shared singleton, so we flush rather than shutdown it here.
 */
export function captureServerEvent({
  distinctId,
  event,
  properties,
  groups,
}: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  groups?: Record<string, string>;
}): void {
  let maybeClient: PostHog | null;
  try {
    // getClient() reads the full server env (via serverEnv()), which can
    // throw in an environment where unrelated required vars aren't set
    // (e.g. a unit test that never configured Supabase env vars). That must
    // never propagate into caller code, so it's inside this try too.
    maybeClient = getClient();
  } catch (err) {
    console.error("[posthog] client init failed", err);
    return;
  }
  if (!maybeClient) return;
  const posthog = maybeClient;

  try {
    posthog.capture({ distinctId, event, properties, groups });
  } catch (err) {
    console.error("[posthog] capture failed", err);
    return;
  }

  try {
    after(async () => {
      try {
        await posthog.flush();
      } catch (err) {
        console.error("[posthog] flush failed", err);
      }
    });
  } catch (err) {
    console.error("[posthog] after() call failed", err);
  }
}
