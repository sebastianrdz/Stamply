import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCardByToken,
  getOtherActiveCardsForCustomer,
} from "@/lib/cards/queries";
import { cardState } from "@/lib/cards/state";
import { cardText } from "@/lib/cards/text";
import { getAvailableStandaloneRewardsForCustomer } from "@/lib/rewards/queries";
import { qrDataUrl } from "@/lib/qr";
import { brandStyle } from "@/lib/brand";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { LoyaltyCard } from "@/components/loyalty-card";
import { WalletButtons } from "./wallet-buttons";
import { NotificationsSection } from "./notifications-section";

export async function generateMetadata({
  params,
}: PageProps<"/c/[token]">): Promise<Metadata> {
  const { token } = await params;
  const dict = await getDictionary(await getLocale());
  const admin = createAdminClient();
  let card: Awaited<ReturnType<typeof getCardByToken>>;
  try {
    card = await getCardByToken(admin, token);
  } catch (e) {
    // Same rationale as the page body's try/catch below: a real backend
    // failure shouldn't surface as a broken metadata lookup — fall back to
    // the generic site description instead.
    console.error("[card] metadata lookup failed", e);
    return { description: dict.seo.description };
  }
  if (!card) return { description: dict.seo.description };
  return {
    title: interpolate(dict.card.meta.title, { business: card.business.name }),
    description: interpolate(dict.card.meta.description, {
      business: card.business.name,
    }),
  };
}

export default async function CardPage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const admin = createAdminClient();
  let card: Awaited<ReturnType<typeof getCardByToken>>;
  try {
    card = await getCardByToken(admin, token);
  } catch (e) {
    // A real backend failure shouldn't masquerade as a missing card (404) or
    // crash into an unstyled 500 — show a friendly, retryable error instead.
    console.error("[card] lookup failed", e);
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-lg font-semibold">{dict.card.error.title}</h1>
        <p className="text-muted-foreground text-sm">
          {dict.card.error.description}
        </p>
      </div>
    );
  }
  if (!card) notFound();

  const state = cardState(card, card.program);
  const text = cardText(state, card.program, dict.wallet, {
    locale,
    business: card.business.name,
    rewards: card.rewards,
    timeZone: card.business.timezone,
  });
  const completed = card.status === "completed";
  // Standalone rewards and other-programs are supplementary "what's new"
  // info for the notifications section below — best-effort, matching
  // src/app/api/scan/route.ts's precedent for this same lookup: a DB failure
  // here shouldn't 500 the whole card page (via the nearest error boundary)
  // over what's ultimately a secondary block, so degrade to an empty list
  // and let the rest of the page render normally.
  const [qr, standaloneRewards, otherPrograms] = await Promise.all([
    qrDataUrl(card.barcode_value, { width: 260 }),
    getAvailableStandaloneRewardsForCustomer(
      admin,
      card.business_id,
      card.customer_id,
    ).catch((e) => {
      console.error("[card] standalone rewards lookup failed", e);
      return [];
    }),
    getOtherActiveCardsForCustomer(
      admin,
      card.business_id,
      card.customer_id,
      card.id,
    ).catch((e) => {
      console.error("[card] other active cards lookup failed", e);
      return [];
    }),
  ]);
  // Rewards are per-program: this card's own banked count, not a sum across the
  // customer's cards in other programs.
  const availableRewards = card.rewards;

  return (
    <div
      className="flex min-h-full flex-col items-center px-6 py-10"
      style={brandStyle(card.business)}
    >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LoyaltyCard
          businessName={card.business.name}
          program={card.program}
          progress={state.progress}
          panel={
            text.legacy
              ? undefined
              : {
                  header: text.header,
                  headline: text.headline,
                  detail: text.detail,
                  side: text.secondary[0] ?? null,
                }
          }
          completed={completed}
          logoUrl={card.business.logo_url}
          backgroundImageUrl={card.business.background_image_url}
          stampIconUrl={card.business.stamp_icon_url}
          showBusinessName={card.business.show_business_name}
          customerName={card.customer.full_name}
          availableRewards={availableRewards}
          qrImageUrl={qr}
          stampsLabel={text.header.label}
          nameLabel={dict.card.name}
          rewardsLabel={dict.card.rewards}
          guestLabel={dict.card.guest}
          rewardReadyLabel={dict.card.rewardReady}
        />

        <WalletButtons
          token={token}
          locale={locale}
          appleLabel={dict.card.addAppleWallet}
          googleLabel={dict.card.addGoogleWallet}
        />

        <NotificationsSection
          dict={dict}
          locale={locale}
          standaloneRewards={standaloneRewards}
          otherPrograms={otherPrograms}
        />

        <p className="text-muted-foreground text-center text-xs">
          {dict.common.poweredBy}
        </p>
      </div>
    </div>
  );
}
