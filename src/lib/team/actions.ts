"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  ACTIVE_BUSINESS_COOKIE,
  getUser,
  requireRole,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertWithinLimit,
  LimitExceededError,
} from "@/lib/billing/entitlements";
import { isInviteExpired } from "./shared";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email."),
  // Owners are created only at business creation; invites are employee/admin.
  role: z.enum(["employee", "admin"]),
});

export interface InviteState {
  error?: string;
  /** Relative accept path (e.g. /join/<token>) on success. */
  path?: string;
}

/** Owner/admin creates a tokenized invite and gets a shareable /join link. */
export async function createInvitation(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { user, membership } = await requireRole(["owner", "admin"]);
  const business = membership.business;

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  try {
    await assertWithinLimit(supabase, business, "employees");
  } catch (e) {
    if (e instanceof LimitExceededError) return { error: e.message };
    throw e;
  }

  const token = nanoid(32);
  const { error } = await supabase.from("invitations").insert({
    business_id: business.id,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    token,
    invited_by: user.id,
    expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/team");
  return { path: `/join/${token}` };
}

/** Owner/admin revokes a pending invite. RLS scopes it to their business. */
export async function revokeInvitation(id: string) {
  await requireRole(["owner", "admin"]);
  const supabase = await createClient();
  await supabase.from("invitations").delete().eq("id", id);
  revalidatePath("/dashboard/team");
}

/** Owner/admin removes a team member. The owner membership can't be removed. */
export async function removeMembership(id: string) {
  await requireRole(["owner", "admin"]);
  const supabase = await createClient();
  await supabase.from("memberships").delete().eq("id", id).neq("role", "owner");
  revalidatePath("/dashboard/team");
}

export interface AcceptState {
  error?: string;
}

/**
 * Accept an invite for the signed-in user. Runs with the service-role client
 * because the user is not yet a member of the business (so RLS can't see the
 * invite). Re-checks the tier limit — this is the authoritative gate, since
 * pending invites aren't counted against the limit at creation time.
 */
export async function acceptInvitation(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  const user = await getUser();
  if (!user) redirect(`/login?next=/join/${token}`);

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return { error: "This invite link is invalid." };
  if (invite.accepted_at)
    return { error: "This invite has already been used." };
  if (isInviteExpired(invite.expires_at))
    return { error: "This invite has expired. Ask for a new one." };
  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase())
    return {
      error: `This invite is for ${invite.email}. Sign in with that email to accept.`,
    };

  const { data: existing } = await admin
    .from("memberships")
    .select("id")
    .eq("business_id", invite.business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { data: business } = await admin
      .from("businesses")
      .select("id, plan")
      .eq("id", invite.business_id)
      .single();
    if (!business) return { error: "That business no longer exists." };

    try {
      await assertWithinLimit(admin, business, "employees");
    } catch (e) {
      if (e instanceof LimitExceededError)
        return { error: "This team is full. Ask the owner to upgrade." };
      throw e;
    }

    const { error } = await admin.from("memberships").insert({
      business_id: invite.business_id,
      user_id: user.id,
      role: invite.role,
      email: user.email ?? null,
    });
    if (error) return { error: error.message };
  }

  await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Make the joined business active, then land on the dashboard.
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, invite.business_id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  redirect("/dashboard");
}
