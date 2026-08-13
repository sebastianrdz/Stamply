import Image from "next/image";
import { cn } from "@stamply/ui/utils";
import { computeStampGrid } from "@/lib/wallet/stamp-layout";
import type { Program } from "@/types/database";

/**
 * Visual representation of a stamp/points card — mirrors the Apple/Google
 * Wallet pass design: a single brand-colored surface, top to bottom:
 * logo + business name / stamps count header, a big stamp strip (or the
 * business's background image), a name/rewards row, and the QR code.
 */
export function LoyaltyCard({
  businessName,
  program,
  progress,
  completed,
  logoUrl,
  backgroundImageUrl,
  stampIconUrl,
  showBusinessName = true,
  customerName,
  availableRewards,
  qrImageUrl,
  stampsLabel,
  nameLabel,
  rewardsLabel,
  guestLabel,
  rewardReadyLabel,
}: {
  businessName: string;
  program: Pick<Program, "name" | "type" | "goal" | "reward_description">;
  progress: number;
  completed: boolean;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  stampIconUrl?: string | null;
  showBusinessName?: boolean;
  customerName?: string | null;
  availableRewards: number;
  qrImageUrl: string;
  /** Localized copy — this is a server component with no dictionary access
   *  of its own, so the caller passes the already-resolved strings. */
  stampsLabel: string;
  nameLabel: string;
  rewardsLabel: string;
  guestLabel: string;
  rewardReadyLabel: string;
}) {
  const grid =
    program.type === "stamp" ? computeStampGrid(progress, program.goal) : null;

  return (
    <div className="bg-brand overflow-hidden rounded-2xl text-[hsl(var(--brand-foreground))] shadow-lg">
      {/* Header — logo + business name, stamps count. All on brand color. */}
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl && (
            <Image
              src={logoUrl}
              alt={`${businessName} logo`}
              width={52}
              height={52}
              unoptimized
              className="size-13 shrink-0 object-contain"
            />
          )}
          <div className="min-w-0">
            {showBusinessName && (
              <h2 className="truncate text-lg font-bold">{businessName}</h2>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-semibold tracking-wide text-[hsl(var(--brand-foreground))]/70 uppercase">
            {stampsLabel}
          </p>
          <p className="text-lg font-bold">
            {completed ? rewardReadyLabel : `${progress}/${program.goal}`}
          </p>
        </div>
      </div>

      {/* Stamp strip — business background image (with dark overlay) or
       *  solid brand color fallback. Big stamps on top. */}
      <div className="relative mx-5 overflow-hidden rounded-xl">
        {backgroundImageUrl ? (
          <>
            <Image
              src={backgroundImageUrl}
              alt=""
              fill
              unoptimized
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/40" />
          </>
        ) : (
          <div className="bg-brand absolute inset-0" />
        )}
        <div className="relative p-4">
          {program.type === "stamp" && grid ? (
            <div className="flex flex-col gap-3">
              {grid.rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex justify-center gap-3">
                  {row.map((slot, slotIndex) =>
                    stampIconUrl ? (
                      // Custom stamp icon: rendered as a plain <img> (never
                      // inline <svg>/dangerouslySetInnerHTML) so untrusted
                      // SVG markup is never executed. Shown in its own
                      // colors — full opacity when filled, dimmed when not.
                      // eslint-disable-next-line @next/next/no-img-element -- must stay a raw <img>, not next/image, so no SVG allowlisting is needed in next.config.
                      <img
                        key={slotIndex}
                        src={stampIconUrl}
                        alt=""
                        className="aspect-square max-w-14 flex-1 object-contain"
                        style={{ opacity: slot.filled ? 1 : 0.25 }}
                      />
                    ) : (
                      <div
                        key={slotIndex}
                        className={cn(
                          "aspect-square max-w-16 flex-1 rounded-full",
                          slot.filled
                            ? "bg-[hsl(var(--brand-foreground))]"
                            : "border-2 border-[hsl(var(--brand-foreground))]/40",
                        )}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">{progress}</span>
                <span className="text-sm text-[hsl(var(--brand-foreground))]/80">
                  / {program.goal} pts
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--brand-foreground))]/25">
                <div
                  className="h-full rounded-full bg-[hsl(var(--brand-foreground))]"
                  style={{
                    width: `${Math.min(100, (progress / program.goal) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NAME / REWARDS row — still on the brand band. */}
      <div className="flex items-end justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-[hsl(var(--brand-foreground))]/70 uppercase">
            {nameLabel}
          </p>
          <p className="truncate text-sm font-semibold">
            {customerName || guestLabel}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-semibold tracking-wide text-[hsl(var(--brand-foreground))]/70 uppercase">
            {rewardsLabel}
          </p>
          <p className="text-2xl font-bold">{availableRewards}</p>
        </div>
      </div>

      {/* QR code — inside the card, centered, in a white box. */}
      <div className="flex justify-center p-5">
        <div className="rounded-xl bg-white p-3">
          <Image src={qrImageUrl} alt="" width={150} height={150} unoptimized />
        </div>
      </div>
    </div>
  );
}
