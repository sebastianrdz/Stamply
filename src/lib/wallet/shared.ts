import "server-only";

import { serverEnv } from "@/lib/env";

/** Absolute base URL of the app (no trailing slash), for pass web-service URLs. */
export function appUrlBase(): string {
  return serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}
