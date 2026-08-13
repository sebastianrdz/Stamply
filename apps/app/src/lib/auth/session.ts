import "server-only";

import { cache } from "react";
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
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** All businesses the current user belongs to, with their role. */
export const getMemberships = cache(async (): Promise<BusinessMembership[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  // Scope to THIS user's rows. RLS lets a member read every membership of their
  // businesses (co-workers included), so without this filter a user who belongs
  // to a business alongside others would pick up the others' roles too.
  const { data, error } = await supabase
    .from("memberships")
    .select("role, business:businesses(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data
    .filter((m) => m.business)
    .map((m) => ({
      role: m.role,
      business: m.business as unknown as Business,
    }));
});

/**
 * Resolve the active business for the current user from the cookie, falling
 * back to the first membership. Returns null if the user belongs to none.
 */
export const getActiveBusiness = cache(
  async (): Promise<BusinessMembership | null> => {
    const memberships = await getMemberships();
    if (memberships.length === 0) return null;

    const cookieStore = await cookies();
    const activeId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
    return (
      memberships.find((m) => m.business.id === activeId) ?? memberships[0]
    );
  },
);

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

/**
 * Like `requireBusiness`, but also requires the active membership's role to be
 * one of `roles`. Redirects to /dashboard if the user lacks the role. Use as the
 * server-side gate for admin/owner-only pages and mutating actions — hiding a
 * nav item is not sufficient since a user could still hit the route/action.
 */
export async function requireRole(roles: MembershipRole[]): Promise<{
  user: User;
  membership: BusinessMembership;
}> {
  const ctx = await requireBusiness();
  if (!roles.includes(ctx.membership.role)) redirect("/dashboard");
  return ctx;
}
