import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { getUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.auth.resetPassword.metaTitle };
}

export default async function ResetPasswordPage() {
  const dict = await getDictionary(await getLocale());

  // Requires the active recovery session `/auth/confirm?type=recovery`
  // establishes — without one, there's nothing to reset here.
  const user = await getUser();
  if (!user) redirect("/forgot-password");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {dict.auth.resetPassword.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {dict.auth.resetPassword.subtitle}
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
