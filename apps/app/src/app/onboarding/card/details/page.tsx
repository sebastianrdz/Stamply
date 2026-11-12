import type { Metadata } from "next";
import { requireOnboardingBusiness } from "@/lib/auth/onboarding";
import { createClient } from "@/lib/supabase/server";
import { cardDesign } from "@/lib/programs/design";
import { getFirstProgram } from "@/lib/programs/first-program";
import { listAssets } from "@/lib/assets/library";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { OnboardingPageShell } from "@/components/onboarding/page-shell";
import { ProgramForm } from "@/app/dashboard/cards/new/program-form";
import type { ProgramType } from "@/types/database";

const TYPES: ProgramType[] = ["stamp", "points", "coupon", "membership"];

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.onboarding.card.details.metaTitle };
}

export default async function OnboardingCardDetailsPage({
  searchParams,
}: PageProps<"/onboarding/card/details">) {
  const { type } = await searchParams;
  const initialType = TYPES.find((t) => t === type) ?? "stamp";
  const { membership } = await requireOnboardingBusiness();
  const business = membership.business;
  const copy = (await getDictionary(await getLocale())).onboarding.card;
  const program = (await getFirstProgram(business.id)) ?? undefined;

  return (
    <OnboardingPageShell
      wide
      title={copy.details.title}
      subtitle={copy.details.subtitle}
      backHref={program ? "/onboarding/plan" : "/onboarding/card"}
      backLabel={copy.back}
      skipHref="/onboarding/plan"
      skipLabel={copy.skip}
    >
      <ProgramForm
        section="details"
        flow="onboarding-details"
        program={program}
        initialType={initialType}
        businessName={business.name}
        design={cardDesign(program ?? {}, business)}
        library={await listAssets(await createClient(), business.id)}
        defaultName={interpolate(copy.details.defaultName, {
          business: business.name,
        })}
      />
    </OnboardingPageShell>
  );
}
