"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ACTIVE_BUSINESS_COOKIE,
  getMemberships,
  getUser,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";

export interface ProfileState {
  error?: string;
  ok?: boolean;
}

/**
 * Update the signed-in user's own profile: display name (stored in auth
 * user_metadata) and, optionally, their password. Email changes are omitted —
 * Supabase requires an email-confirmation round-trip, which needs a
 * dedicated confirm-and-swap flow (not just SMTP, which is now configured via
 * Resend — see `@/lib/email`). Left as a future feature, not in scope here.
 */
export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const dict = await getDictionary(await getLocale());
  const user = await getUser();
  if (!user) return { error: dict.dashboard.settings.errors.notSignedIn };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (fullName.length > 120)
    return { error: dict.dashboard.settings.errors.nameTooLong };

  if (password) {
    if (password.length < 8)
      return { error: dict.dashboard.settings.errors.passwordTooShort };
    if (password !== confirm)
      return { error: dict.dashboard.settings.errors.passwordMismatch };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: fullName },
    ...(password ? { password } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export interface DeleteAccountState {
  error?: string;
}

/**
 * Permanently delete the signed-in user's own account. Blocked while they
 * still own a business — ownership must be transferred or the business
 * deleted first, since `businesses.owner_user_id` is `ON DELETE RESTRICT`.
 * `formData` is unused (no confirmation text is parsed here — that's the
 * frontend's job) but kept in the signature to match the `useActionState`
 * action shape used elsewhere in this codebase.
 */
export async function deleteAccount(
  _prev: DeleteAccountState,
  _formData: FormData,
): Promise<DeleteAccountState> {
  const dict = await getDictionary(await getLocale());
  const user = await getUser();
  if (!user) return { error: dict.dashboard.settings.errors.notSignedIn };

  // Checked against `business.owner_user_id` (the actual FK with
  // ON DELETE RESTRICT), not `membership.role === "owner"`. Those two
  // normally agree, but only because `createBusiness` does two
  // non-transactional inserts (business row, then owner membership row) — if
  // the second insert ever failed, a business could have `owner_user_id` set
  // with no owner membership row, which would slip past a role-based check
  // and then fail deleteUser with a raw Postgres FK error instead of this
  // friendly, actionable message.
  const memberships = await getMemberships();
  const owned = memberships.filter((m) => m.business.owner_user_id === user.id);
  if (owned.length > 0) {
    return {
      error: interpolate(dict.dashboard.settings.errors.ownsBusinessCantDelete, {
        businesses: owned.map((m) => m.business.name).join(", "),
      }),
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error)
    return {
      error: error.message || dict.dashboard.settings.errors.deleteAccountFailed,
    };

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BUSINESS_COOKIE);
  redirect("/login");
}
