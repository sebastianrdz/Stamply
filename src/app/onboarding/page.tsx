import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, getActiveBusiness } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.onboarding.setup.metaTitle };
}

function wantsToAdd(value: string | string[] | undefined): boolean {
  return Array.isArray(value) ? value.includes("1") : value === "1";
}

export default async function OnboardingPage({
  searchParams,
}: PageProps<"/onboarding">) {
  const params = await searchParams;
  const isAdding = wantsToAdd(params.add);
  const dict = await getDictionary(await getLocale());

  const user = await getUser();
  if (!user) redirect("/login");
  // Already has a business → straight to the dashboard, unless they're
  // explicitly here to add another one.
  const existing = await getActiveBusiness();
  if (existing && !isAdding) redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col">
      <header className="p-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight">
              {isAdding
                ? dict.onboarding.add.title
                : dict.onboarding.setup.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isAdding
                ? dict.onboarding.add.subtitle
                : dict.onboarding.setup.subtitle}
            </p>
          </div>
          <OnboardingForm showCancel={isAdding} />
        </div>
      </main>
    </div>
  );
}
