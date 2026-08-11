import Image from "next/image";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCardByToken,
  cardProgress,
  availableRewardsForCustomer,
} from "@/lib/cards/queries";
import { qrDataUrl } from "@/lib/qr";
import { brandStyle } from "@/lib/brand";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LoyaltyCard } from "@/components/loyalty-card";
import { WalletButtons } from "./wallet-buttons";

export default async function CardPage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const dict = await getDictionary(await getLocale());
  const admin = createAdminClient();
  const card = await getCardByToken(admin, token);
  if (!card) notFound();

  const progress = cardProgress(card, card.program);
  const completed = card.status === "completed";
  const qr = await qrDataUrl(card.barcode_value, { width: 260 });
  const availableRewards = await availableRewardsForCustomer(
    admin,
    card.business_id,
    card.customer_id,
  );

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
          stampsLabel={dict.card.stamps}
          availableRewardsLabel={dict.card.availableRewards}
          customerLabel={dict.card.customer}
          guestLabel={dict.card.guest}
          rewardReadyLabel={dict.card.rewardReady}
        />

        <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border p-6">
          <p className="text-sm font-medium">{dict.card.showAtCheckout}</p>
          <div className="border-border rounded-xl border bg-white p-3">
            <Image
              src={qr}
              alt={dict.card.qrAlt}
              width={200}
              height={200}
              unoptimized
            />
          </div>
        </div>

        <WalletButtons
          token={token}
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
