"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import { getUser } from "@/lib/auth/session";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const slugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 5);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

const schema = z.object({
  name: z.string().min(2, "Business name is required.").max(80),
});

export interface CreateBusinessState {
  error?: string;
}

export async function createBusiness(
  _prev: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const base = slugify(parsed.data.name) || "biz";
  const slug = `${base}-${slugSuffix()}`;

  const { data: business, error } = await admin
    .from("businesses")
    .insert({ name: parsed.data.name, slug, owner_user_id: user.id })
    .select()
    .single();

  if (error || !business) {
    return { error: error?.message ?? "Could not create business." };
  }

  const { error: membershipError } = await admin
    .from("memberships")
    .insert({ business_id: business.id, user_id: user.id, role: "owner" });

  if (membershipError) {
    return { error: membershipError.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, business.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  redirect("/dashboard");
}

/** Switch the active business (must be a member — verified via RLS read). */
export async function setActiveBusiness(businessId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  redirect("/dashboard");
}
