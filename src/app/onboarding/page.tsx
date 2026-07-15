import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, getActiveBusiness } from "@/lib/auth/session";
import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  // Already has a business → straight to the dashboard.
  const existing = await getActiveBusiness();
  if (existing) redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col">
      <header className="p-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight">
              Set up your business
            </h1>
            <p className="text-muted-foreground text-sm">
              This is the name your customers will see on their loyalty card.
              You can add locations and branding next.
            </p>
          </div>
          <OnboardingForm />
        </div>
      </main>
    </div>
  );
}
