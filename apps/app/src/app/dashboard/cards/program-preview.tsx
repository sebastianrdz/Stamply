import { AppleWalletCardPreview } from "@stamply/ui/apple-wallet-card-preview";
import type { ComponentProps } from "react";
import type { Dictionary } from "@stamply/i18n/dictionaries";
import { cardText } from "@/lib/cards/text";
import { cardDesign, type BusinessBrand } from "@/lib/programs/design";
import type { Program } from "@/types/database";

// Sample progress for the preview; real customers' progress is not per-program.
const SAMPLE_STAMPS = 3;

/** A program rendered as an Apple Wallet card with sample data (same props as the edit form's preview). */
export function ProgramPreview({
  program: p,
  business,
  dict,
  locale,
  ...rest
}: {
  program: Program;
  business: BusinessBrand & { name: string };
  dict: Dictionary;
  locale: string;
} & Pick<
  ComponentProps<typeof AppleWalletCardPreview>,
  "barcode" | "halfView" | "className"
>) {
  const d = cardDesign(p, business);
  const config = (p.config ?? {}) as Record<string, unknown>;
  const tiers = (Array.isArray(config.tiers) ? config.tiers : []) as {
    points: number;
    reward: string;
    name?: string;
  }[];
  const goal =
    p.type === "stamp" || p.type === "points" ? Math.max(p.goal, 1) : 1;
  const progress = Math.min(SAMPLE_STAMPS, goal);
  const text = cardText(
    {
      type: p.type,
      progress,
      goal,
      available: 0,
      nextTier: p.type === "points" && tiers[0] ? tiers[0] : null,
      usesLeft: typeof config.max_uses === "number" ? config.max_uses : null,
      until:
        p.type === "coupon" || p.type === "membership"
          ? "2030-01-01T00:00:00.000Z"
          : null,
      tier: p.type === "membership" ? (tiers[0]?.name ?? null) : null,
      expired: false,
      actions: [],
    },
    p,
    dict.wallet,
    { locale, business: business.name, rewards: 0 },
  );

  const slotIcons: Record<number, string> = {};
  const slotColors: Record<number, string> = {};
  if (p.type === "stamp") {
    const milestones = (
      Array.isArray(config.milestones) ? config.milestones : []
    ) as {
      at: number;
      icon_url?: string;
      icon_color?: string;
    }[];
    for (const m of milestones) {
      if (m.icon_url) slotIcons[m.at] = m.icon_url;
      if (m.icon_color) slotColors[m.at] = m.icon_color;
    }
    if (typeof config.reward_icon_url === "string")
      slotIcons[goal] = config.reward_icon_url;
    if (typeof config.reward_icon_color === "string")
      slotColors[goal] = config.reward_icon_color;
  }

  return (
    <AppleWalletCardPreview
      backgroundColor={d.primary_color}
      logoUrl={d.logo_url}
      logoText={d.show_business_name ? business.name : null}
      headerFields={[text.header]}
      strip={
        p.type === "stamp"
          ? {
              imageUrl: d.background_image_url,
              overlayOpacity: d.overlay_opacity,
              stamps: {
                progress,
                goal,
                iconUrl: d.stamp_icon_url,
                iconColor: d.stamp_color,
                slotIcons,
                slotColors,
              },
            }
          : d.background_image_url
            ? {
                imageUrl: d.background_image_url,
                overlayOpacity: d.overlay_opacity,
              }
            : null
      }
      primaryField={text.primary}
      secondaryFields={[
        { label: dict.card.name, value: dict.card.guest },
        ...text.secondary.map((x) => (text.legacy ? { ...x, value: 0 } : x)),
      ]}
      auxiliaryFields={text.auxiliary}
      {...rest}
    />
  );
}
