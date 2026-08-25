"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary, type Dictionary } from "@stamply/i18n/dictionaries";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/email/send";
import { appUrl } from "@/lib/urls";
import { rateLimit } from "@/lib/rate-limit";

function buildSchema(dict: Dictionary) {
  return z.object({
    email: z.string().email(dict.common.validation.emailInvalid),
    password: z.string().min(8, dict.common.validation.passwordTooShort),
  });
}

/** Only forward internal, single-slash paths (guards against open redirects
 *  via protocol-relative "//evil.com" or absolute "https://evil.com" URLs). */
function safeNext(raw: string): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "";
}

export interface AuthState {
  error?: string;
  /** Set instead of redirecting when signup requires the emailed
   *  confirmation link to be clicked before a session exists. */
  checkEmail?: boolean;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const dict = await getDictionary(await getLocale());
  const parsed = buildSchema(dict).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  const next = (formData.get("next") as string) || "/dashboard";
  redirect(next);
}

/**
 * Creates the user via the admin API (which — for `type: "signup"` —
 * generates the confirmation link AND creates the user/sets the password in
 * one call) instead of `supabase.auth.signUp()`, so we can build and send our
 * own branded confirmation email instead of relying on Supabase's built-in
 * SMTP templates. Because "Confirm email" is on, no session exists until the
 * emailed link is clicked — so this returns `{ checkEmail: true }` rather
 * than redirecting.
 */
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const parsed = buildSchema(dict).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Honor an explicit post-confirm destination (e.g. an invite accept link);
  // otherwise land new owners on onboarding to create their business. This is
  // threaded into the confirmation link itself (not just this response),
  // since the request that resumes the flow is the emailed-link click, not
  // this form submission.
  const rawNext = safeNext((formData.get("next") as string) || "");
  const next = rawNext && rawNext !== "/dashboard" ? rawNext : "/onboarding";

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  const confirmUrl = `${appUrl()}/auth/confirm?token_hash=${encodeURIComponent(
    data.properties.hashed_token,
  )}&type=signup&next=${encodeURIComponent(next)}`;

  const result = await sendVerificationEmail({
    to: parsed.data.email,
    url: confirmUrl,
    locale,
  });
  if (!result.ok) {
    console.error("[auth] failed to send verification email", result.error);
    return { error: dict.auth.errors.emailSendFailed };
  }

  return { checkEmail: true };
}

export async function signOut(next?: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const safe = safeNext(next ?? "");
  redirect(safe ? `/login?next=${encodeURIComponent(safe)}` : "/login");
}

export interface RequestPasswordResetState {
  error?: string;
  ok?: boolean;
}

/**
 * Request a password-reset email. Enumeration-safe: always resolves to the
 * same `{ ok: true }` regardless of whether an account exists for the
 * submitted email — the response (and its shape/timing) must never reveal
 * that. Rate-limited per email+IP since, unlike enrollment, this touches a
 * specific account and isn't expected to be called from a shared IP often.
 */
export async function requestPasswordReset(
  _prev: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const parsed = z
    .object({ email: z.string().email(dict.common.validation.emailInvalid) })
    .safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const email = parsed.data.email.toLowerCase();

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  if (!ip) {
    console.warn(
      "[auth] missing x-forwarded-for; rate-limiting password reset by email only for this request",
    );
  }
  const rateLimitKey = `password-reset:${email}:${ip ?? "no-ip"}`;
  if (!(await rateLimit(rateLimitKey, 3, 15 * 60 * 1000))) {
    return { error: dict.auth.forgotPassword.errors.tooManyAttempts };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (error) {
      // Expected when there's no account for this email — swallow it rather
      // than letting the caller distinguish "no account" from "sent".
      console.error("[auth] generateLink(recovery) failed", error.message);
    } else {
      const confirmUrl = `${appUrl()}/auth/confirm?token_hash=${encodeURIComponent(
        data.properties.hashed_token,
      )}&type=recovery&next=${encodeURIComponent("/reset-password")}`;
      const result = await sendPasswordResetEmail({
        to: email,
        url: confirmUrl,
        locale,
      });
      if (!result.ok) {
        console.error(
          "[auth] failed to send password reset email",
          result.error,
        );
      }
    }
  } catch (err) {
    console.error("[auth] password reset request threw", err);
  }

  return { ok: true };
}

export interface ResetPasswordState {
  error?: string;
  ok?: boolean;
}

/**
 * Complete a password reset for the active recovery session established by
 * `/auth/confirm?type=recovery`. Reuses the same `updateUser({ password })`
 * call as `profile-actions.ts`'s self-service password change.
 */
export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const dict = await getDictionary(await getLocale());
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (password.length < 8)
    return { error: dict.auth.resetPassword.errors.passwordTooShort };
  if (password !== confirm)
    return { error: dict.auth.resetPassword.errors.passwordMismatch };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { ok: true };
}
