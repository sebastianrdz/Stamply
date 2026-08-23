import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardByToken, cardProgress } from "@/lib/cards/queries";
import { qrDataUrl } from "@/lib/qr";
import { brandStyle } from "@/lib/brand";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { LoyaltyCard } from "@/components/loyalty-card";
import { WalletButtons } from "./wallet-buttons";

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

  const progress = cardProgress(card, card.program);
  const completed = card.status === "completed";
  const qr = await qrDataUrl(card.barcode_value, { width: 260 });
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
          progress={progress}
          completed={completed}
          logoUrl={card.business.logo_url}
          backgroundImageUrl={card.business.background_image_url}
          stampIconUrl={card.business.stamp_icon_url}
          showBusinessName={card.business.show_business_name}
          customerName={card.customer.full_name}
          availableRewards={availableRewards}
          qrImageUrl={qr}
          stampsLabel={dict.card.stamps}
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

        <p className="text-muted-foreground text-center text-xs">
          {dict.common.poweredBy}
        </p>
      </div>
    </div>
  );
}
