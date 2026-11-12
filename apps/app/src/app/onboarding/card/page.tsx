import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboardingBusiness } from "@/lib/auth/onboarding";
import { getFirstProgram } from "@/lib/programs/first-program";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { Button } from "@stamply/ui/button";
import { OnboardingPageShell } from "@/components/onboarding/page-shell";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.onboarding.card.type.metaTitle };
}

export default async function OnboardingCardTypePage() {
  const { membership } = await requireOnboardingBusiness();
  // A card already exists (type can't change): carry on editing it.
  if (await getFirstProgram(membership.business.id))
    redirect("/onboarding/card/details");

  const dict = await getDictionary(await getLocale());
  const copy = dict.onboarding.card;
  const f = dict.dashboard.programs.form;
  const types = [
    { value: "stamp", label: f.typeStamp, hint: f.typeStampHint },
    { value: "points", label: f.typePoints, hint: f.typePointsHint },
    { value: "coupon", label: f.typeCoupon, hint: f.typeCouponHint },
    {
      value: "membership",
      label: f.typeMembership,
      hint: f.typeMembershipHint,
    },
  ];

  return (
    <OnboardingPageShell
      title={copy.type.title}
      subtitle={copy.type.subtitle}
      skipHref="/onboarding/plan"
      skipLabel={copy.skip}
    >
      <form
        method="get"
        action="/onboarding/card/details"
        className="flex flex-col gap-6"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{f.typeLabel}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {types.map((t) => (
              <label
                key={t.value}
                className="border-border has-[:checked]:border-primary has-[:checked]:bg-muted has-[:focus-visible]:ring-ring flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl border p-4 transition-colors duration-150 has-[:focus-visible]:ring-2"
              >
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  defaultChecked={t.value === "stamp"}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {t.label}
                  {t.value === "stamp" && (
                    <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                      {copy.type.recommended}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">{t.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-muted-foreground text-sm">{copy.type.lockNote}</p>
        <div>
          <Button type="submit" size="lg">
            {copy.type.continue}
          </Button>
        </div>
      </form>
    </OnboardingPageShell>
  );
}
