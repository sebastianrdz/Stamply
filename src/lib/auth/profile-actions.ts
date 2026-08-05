"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export interface ProfileState {
  error?: string;
  ok?: boolean;
}

/**
 * Update the signed-in user's own profile: display name (stored in auth
 * user_metadata) and, optionally, their password. Email changes are omitted —
 * Supabase requires an email-confirmation round-trip, which needs SMTP the app
 * doesn't have configured yet.
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
