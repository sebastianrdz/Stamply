import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { AuthForm } from "../auth-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.auth.login.metaTitle };
}

export default async function LoginPage() {
  const dict = await getDictionary(await getLocale());
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {dict.auth.login.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {dict.auth.login.subtitle}
        </p>
      </div>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
