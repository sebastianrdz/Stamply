import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Business, MembershipRole } from "@/types/database";

export const ACTIVE_BUSINESS_COOKIE = "stamply_active_business";

export interface BusinessMembership {
  business: Business;
  role: MembershipRole;
}

/** Current auth user, or null. */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** All businesses the current user belongs to, with their role. */
export async function getMemberships(): Promise<BusinessMembership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, business:businesses(*)")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data
    .filter((m) => m.business)
    .map((m) => ({
      role: m.role,
      business: m.business as unknown as Business,
    }));
}

/**
 * Resolve the active business for the current user from the cookie, falling
 * back to the first membership. Returns null if the user belongs to none.
 */
export async function getActiveBusiness(): Promise<BusinessMembership | null> {
  const memberships = await getMemberships();
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
  return memberships.find((m) => m.business.id === activeId) ?? memberships[0];
}

/** For dashboard pages: require an authed user with a business, else redirect. */
export async function requireBusiness(): Promise<{
  user: User;
  membership: BusinessMembership;
}> {
  const user = await getUser();
  if (!user) redirect("/login");
  const membership = await getActiveBusiness();
  if (!membership) redirect("/onboarding");
  return { user, membership };
}
