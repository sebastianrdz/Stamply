import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboardingBusiness } from "@/lib/auth/onboarding";
import { createClient } from "@/lib/supabase/server";
import { cardDesign } from "@/lib/programs/design";
import { getFirstProgram } from "@/lib/programs/first-program";
import { listAssets } from "@/lib/assets/library";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { OnboardingPageShell } from "@/components/onboarding/page-shell";
import { ProgramForm } from "@/app/dashboard/cards/new/program-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.onboarding.card.design.metaTitle };
}

export default async function OnboardingCardDesignPage() {
  const { membership } = await requireOnboardingBusiness();
  const business = membership.business;
  const program = await getFirstProgram(business.id);
  if (!program) redirect("/onboarding/card");
  const copy = (await getDictionary(await getLocale())).onboarding.card;

  return (
    <OnboardingPageShell
      wide
      title={copy.design.title}
      subtitle={copy.design.subtitle}
      backHref="/onboarding/card/details"
      backLabel={copy.back}
      skipHref="/onboarding/plan"
      skipLabel={copy.skipDesign}
    >
      <ProgramForm
        section="design"
        flow="onboarding-design"
        program={program}
        businessName={business.name}
        design={cardDesign(program, business)}
        library={await listAssets(await createClient(), business.id)}
      />
    </OnboardingPageShell>
  );
}
