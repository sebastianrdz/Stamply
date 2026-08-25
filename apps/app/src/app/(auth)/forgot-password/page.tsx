import type { Metadata } from "next";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.auth.forgotPassword.metaTitle };
}

export default async function ForgotPasswordPage() {
  const dict = await getDictionary(await getLocale());
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {dict.auth.forgotPassword.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {dict.auth.forgotPassword.subtitle}
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
