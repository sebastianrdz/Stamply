import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, getMemberships, getActiveBusiness } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { stripe, isTrialEligible } from "@/lib/billing/stripe";
import { applySubscription } from "@/lib/billing/sync";
import { BillingPlanSelector } from "@/components/billing-plan-selector";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { Logo } from "@stamply/ui/logo";
import { Button } from "@stamply/ui/button";

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
  const dict = await getDictionary(await getLocale());

  const user = await getUser();
  if (!user) redirect("/login");
  const membership = await getActiveBusiness();
  if (!membership) redirect("/onboarding");
  const business = membership.business;

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
    redirect("/dashboard?welcome=1");
  }

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
          <Button variant="ghost" size="sm" type="submit">
            {dict.common.signOut}
          </Button>
        </form>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pb-16">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">
            {interpolate(copy.title, { business: business.name })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isOwner
              ? trialEligible
                ? copy.subtitleTrial
                : copy.subtitle
              : interpolate(copy.ownerOnly, { business: business.name })}
          </p>
        </div>
        {options.length > 1 && (
          <div className="max-w-xs">
            <BusinessSwitcher businesses={options} activeId={business.id} />
          </div>
        )}
        {isOwner && (
          <BillingPlanSelector
            currentTier={business.plan}
            currentInterval={null}
            trialEligible={trialEligible}
          />
        )}
      </main>
    </div>
  );
}
