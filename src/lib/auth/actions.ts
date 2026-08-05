"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

function buildSchema(dict: Dictionary) {
  return z.object({
    email: z.string().email(dict.common.validation.emailInvalid),
    password: z.string().min(8, dict.common.validation.passwordTooShort),
  });
}

export interface AuthState {
  error?: string;
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

export async function signUp(
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
  const { error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: error.message };

  // Honor an explicit post-signup destination (e.g. an invite accept link);
  // otherwise send new owners to onboarding to create their business.
  const next = (formData.get("next") as string) || "";
  redirect(next && next !== "/dashboard" ? next : "/onboarding");
}

export async function signOut(next?: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Only forward internal, single-slash paths (guards against open redirects
  // via protocol-relative "//evil.com" or absolute "https://evil.com" URLs).
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  redirect(safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login");
}
