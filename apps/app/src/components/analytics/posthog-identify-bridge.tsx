"use client";

import { useEffect } from "react";
import { posthog } from "@/lib/posthog/client";
import type { MembershipRole, PlanTier } from "@/types/database";

/**
 * Identifies the current user and their active business to PostHog. Renders
 * nothing — mount once from the dashboard layout only (never on /login,
 * /register, /onboarding, or any customer-facing route).
 */
export function PostHogIdentifyBridge({
  userId,
  businessId,
  role,
  plan,
}: {
  userId: string;
  businessId: string;
  role: MembershipRole;
  plan: PlanTier;
}) {
  useEffect(() => {
    posthog.identify(userId, { role });
    posthog.group("business", businessId, { plan });
  }, [userId, businessId, role, plan]);

  return null;
}
