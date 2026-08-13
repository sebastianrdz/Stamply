import "server-only";

import { ApnsClient, SilentNotification } from "apns2";
import { decodeBase64Env, requireEnv } from "@/lib/env";
import { applePassConfig } from "./certificates";

let client: ApnsClient | null = null;

function apnsClient(): ApnsClient {
  if (client) return client;
  const feature = "Apple Wallet push (APNs)";
  client = new ApnsClient({
    team: requireEnv("APPLE_TEAM_ID", feature),
    keyId: requireEnv("APPLE_APNS_KEY_ID", feature),
    signingKey: decodeBase64Env("APPLE_APNS_KEY_BASE64", feature),
    // PassKit pushes are addressed by the pass type id as topic.
    defaultTopic: applePassConfig().passTypeIdentifier,
    host: "api.push.apple.com",
  });
  return client;
}

/**
 * Send empty background pushes to registered devices; each device responds by
 * re-fetching the latest pass from our web service. Failures are swallowed per
 * token so one bad token doesn't block the rest.
 */
export async function pushToDevices(pushTokens: string[]): Promise<void> {
  if (pushTokens.length === 0) return;
  const topic = applePassConfig().passTypeIdentifier;
  const notifications = pushTokens.map(
    (token) => new SilentNotification(token, { topic }),
  );
  await apnsClient().sendMany(notifications);
}
