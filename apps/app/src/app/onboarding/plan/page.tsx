import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getMemberships, getActiveBusiness } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { stripe, isTrialEligible } from "@/lib/billing/stripe";
import { applySubscription } from "@/lib/billing/sync";
import { PlanChooser } from "@/components/onboarding/plan-chooser";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
import { ProgramPreview } from "@/app/dashboard/cards/program-preview";
import { getFirstProgram } from "@/lib/programs/first-program";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { Logo } from "@stamply/ui/logo";
import { Button, buttonVariants } from "@stamply/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.onboarding.plan.metaTitle };
}

export default async function PlanPage({
  searchParams,
}: PageProps<"/onboarding/plan">) {
  const params = await searchParams;
  const sessionId =
    typeof params.session_id === "string" ? params.session_id : null;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const user = await getUser();
  if (!user) redirect("/login");
  const membership = await getActiveBusiness();
  if (!membership) redirect("/onboarding");
  const business = membership.business;
  // The draft card from the setup step, if they made one.
  const program = await getFirstProgram(business.id);

  // Back from Stripe Checkout: apply the subscription now instead of waiting
  // for the webhook, so the owner doesn't land back on this page.
  if (sessionId && membership.role === "owner" && business.plan === "none") {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      if (
        session.metadata?.business_id === business.id &&
        session.subscription
      ) {
        const sub = await stripe().subscriptions.retrieve(
          session.subscription as string,
        );
        await applySubscription(sub, new Date(sub.created * 1000));
      }
    } catch (e) {
      // The webhook will still apply it; the owner just sees this page once more.
      console.error("[onboarding/plan] post-checkout sync failed", e);
    }
    // Land on the new card (QR + next steps); no card means the dashboard.
    redirect(
      program
        ? `/dashboard/cards/${program.id}?welcome=1`
        : "/dashboard?welcome=1",
    );
  }

  // The webhook may have applied the plan before the owner got back.
  if (sessionId && business.plan !== "none")
    redirect(
      program
        ? `/dashboard/cards/${program.id}?welcome=1`
        : "/dashboard?welcome=1",
    );
  if (business.plan !== "none") redirect("/dashboard");

  const memberships = await getMemberships();
  const options = memberships.map((m) => ({
    id: m.business.id,
    name: m.business.name,
    plan: m.business.plan,
  }));
  const isOwner = membership.role === "owner";
  const trialEligible = isOwner
    ? await isTrialEligible(business.stripe_customer_id)
    : false;
  const copy = dict.onboarding.plan;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between p-6">
        <Logo />
        <form action={signOut.bind(null, undefined)}>
          <Button variant="ghost" size="sm" type="submit" className="h-11">
            {dict.common.signOut}
          </Button>
        </form>
      </header>
      <main className="onboarding-enter mx-auto w-full max-w-5xl flex-1 px-6 pb-16">
        <div className="mb-8 flex max-w-2xl flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            {isOwner && program
              ? copy.titleWithCard
              : interpolate(copy.title, { business: business.name })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isOwner
              ? trialEligible
                ? copy.subtitleTrial
                : copy.subtitle
              : interpolate(copy.ownerOnly, { business: business.name })}
          </p>
        </div>
        {isOwner && (
          <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-12">
            <aside className="lg:sticky lg:top-6">
              {options.length > 1 && (
          <div className="mb-8 max-w-xs">
            <BusinessSwitcher businesses={options} activeId={business.id} />
          </div>
        )}
              {program ? (
                <div className="mx-auto flex w-full max-w-60 flex-col gap-2 lg:mx-0 lg:max-w-none">
                  <ProgramPreview
                    program={program}
                    business={business}
                    dict={dict}
                    locale={locale}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium">
                      {program.name}
                    </p>
                    <Link
                      href="/onboarding/card/details"
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 shrink-0 items-center rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {copy.editCard}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/50 flex flex-col items-start gap-3 rounded-2xl p-5">
                  <h2 className="font-semibold">{copy.noCardTitle}</h2>
                  <p className="text-muted-foreground text-sm">
                    {copy.noCardDescription}
                  </p>
                  <Link
                    href="/onboarding/card"
                    className={buttonVariants({
                      variant: "outline",
                      className: "h-11",
                    })}
                  >
                    {copy.noCardCta}
                  </Link>
                </div>
              )}
            </aside>
            <PlanChooser trialEligible={trialEligible} />
          </div>
        )}
      </main>
    </div>
  );
}
