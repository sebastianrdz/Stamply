import Link from "next/link";
import { AppleWalletCardPreview } from "@stamply/ui/apple-wallet-card-preview";
import { Card } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import type { Dictionary } from "@stamply/i18n/dictionaries";
import { CopyButton } from "@/components/copy-button";
import { cardText } from "@/lib/cards/text";
import { cardDesign, type BusinessBrand } from "@/lib/programs/design";
import { programTagline } from "@/lib/programs/tagline";
import type { Program } from "@/types/database";

// Sample progress for the preview; real customers' progress is not per-program.
const SAMPLE_STAMPS = 3;

/** Program tile: wallet-card preview on top, name/status/share below. Links to the detail page. */
export function ProgramCard({
  program: p,
  business,
  dict,
  locale,
  typeLabel,
  enrollUrl,
}: {
  program: Program;
  business: BusinessBrand & { name: string };
  dict: Dictionary;
  locale: string;
  typeLabel: string;
  enrollUrl: string;
}) {
  const d = cardDesign(p, business);
  const config = (p.config ?? {}) as Record<string, unknown>;
  const tiers = (Array.isArray(config.tiers) ? config.tiers : []) as {
    points: number;
    reward: string;
    name?: string;
  }[];
  const goal = p.type === "stamp" || p.type === "points" ? Math.max(p.goal, 1) : 1;
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
    const milestones = (Array.isArray(config.milestones) ? config.milestones : []) as {
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

  const l = dict.dashboard.programs.list;
  return (
    <Card className="relative flex flex-col overflow-hidden shadow group duration-300 transition-all ">
      <div className="bg-muted/80 p-4 pb-0! sm:p-6">
        <div className="mx-auto w-full max-w-[16rem]">
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
                  ? { imageUrl: d.background_image_url, overlayOpacity: d.overlay_opacity }
                  : null
            }
            primaryField={text.primary}
            secondaryFields={[
              { label: dict.card.name, value: dict.card.guest },
              ...text.secondary.map((x) => (text.legacy ? { ...x, value: 0 } : x)),
            ]}
            auxiliaryFields={text.auxiliary}
            barcode={null}
            halfView
            className="shadow-none group-hover:scale-110 duration-300 transition-all"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">
            {/* Stretched link: the whole tile opens the program; the copy button sits above it. */}
            <Link
              href={`/dashboard/cards/${p.id}`}
              className="after:absolute after:inset-0"
            >
              {p.name}
            </Link>
          </h3>
          <p className="text-muted-foreground text-sm">
            {programTagline(p, dict.programTagline)}
          </p>
        </div>
        <div className="relative z-10 w-fit">
          <CopyButton value={enrollUrl} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <Badge variant={p.active ? "success" : "muted"}>
            {p.active ? l.active : l.paused}
          </Badge>
          <Badge variant="muted" className="uppercase">
            {typeLabel}
          </Badge>
          <span className="text-muted-foreground ml-auto text-xs">
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
              new Date(p.created_at),
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
