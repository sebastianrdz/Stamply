import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  getActiveBusiness,
  getUser,
  type BusinessMembership,
} from "@/lib/auth/session";

/**
 * Gate for the first-run onboarding card steps: authed, has a business that
 * hasn't picked a plan yet, and is an owner/admin. Everyone else is bounced.
 */
export async function requireOnboardingBusiness(): Promise<{
  user: User;
  membership: BusinessMembership;
}> {
  const user = await getUser();
  if (!user) redirect("/login");
  const membership = await getActiveBusiness();
  if (!membership) redirect("/onboarding");
  if (membership.business.plan !== "none") redirect("/dashboard");
  if (membership.role !== "owner" && membership.role !== "admin")
    redirect("/onboarding/plan");
  return { user, membership };
}
