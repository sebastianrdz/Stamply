import Image from "next/image";
import { Stamp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Program } from "@/types/database";

/**
 * Visual representation of a stamp/points card.
 * Header and footer sit on the neutral card surface; the stamp/points band
 * between them is themed by --brand (or the business's background image).
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
  stampsLabel,
  availableRewardsLabel,
  customerLabel,
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
  /** Localized copy — this is a server component with no dictionary access
   *  of its own, so the caller passes the already-resolved strings. */
  stampsLabel: string;
  availableRewardsLabel: string;
  customerLabel: string;
  guestLabel: string;
  rewardReadyLabel: string;
}) {
  return (
    <div className="border-border bg-card text-card-foreground overflow-hidden rounded-2xl border shadow-lg">
      {/* Header — neutral surface. */}
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl && (
            <Image
              src={logoUrl}
              alt={`${businessName} logo`}
              width={40}
              height={40}
              unoptimized
              className="border-border size-10 shrink-0 rounded-lg border bg-white object-contain p-0.5"
            />
          )}
          <div className="min-w-0">
            {showBusinessName && (
              <p className="text-muted-foreground truncate text-sm/5 font-medium">
                {businessName}
              </p>
            )}
            <h2 className="truncate text-lg font-bold">{program.name}</h2>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            {stampsLabel}
          </p>
          <p className="text-lg font-bold">
            {completed ? rewardReadyLabel : `${progress}/${program.goal}`}
          </p>
        </div>
      </div>

      {/* Stamp/points band — brand-colored, or the business background image. */}
      <div className="relative mx-5 overflow-hidden rounded-xl bg-[hsl(var(--brand))] p-5 text-white">
        {backgroundImageUrl && (
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
        )}
        <div className="relative">
          {program.type === "stamp" ? (
            <div className="grid grid-cols-4 gap-2.5">
              {Array.from({ length: program.goal }).map((_, i) =>
                stampIconUrl ? (
                  // Custom stamp icon: used only as a CSS mask (never rendered
                  // as an <img>/inline <svg>) so untrusted SVG markup is never
                  // executed — the mask can only ever paint a solid color.
                  <div key={i} className="aspect-square overflow-hidden rounded">
                    <div
                      aria-hidden
                      className={cn(
                        "size-full",
                        i < progress ? "bg-white" : "bg-white/30",
                      )}
                      style={{
                        WebkitMaskImage: `url(${stampIconUrl})`,
                        maskImage: `url(${stampIconUrl})`,
                        WebkitMaskRepeat: "no-repeat",
                        maskRepeat: "no-repeat",
                        WebkitMaskPosition: "center",
                        maskPosition: "center",
                        WebkitMaskSize: "contain",
                        maskSize: "contain",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    key={i}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-full border-2",
                      i < progress
                        ? "border-white/0 bg-white text-[hsl(var(--brand))]"
                        : "border-white/40 text-white/40",
                    )}
                  >
                    {i < progress ? (
                      <Check className="size-4" strokeWidth={3} />
                    ) : (
                      <Stamp className="size-4" />
                    )}
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">{progress}</span>
                <span className="text-sm opacity-90">/ {program.goal} pts</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white"
                  style={{
                    width: `${Math.min(100, (progress / program.goal) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer — neutral surface. */}
      <div className="flex items-end justify-between gap-3 p-5 pt-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            {customerLabel}
          </p>
          <p className="truncate text-sm font-semibold">
            {customerName || guestLabel}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            {availableRewardsLabel}
          </p>
          <p className="text-2xl font-bold">{availableRewards}</p>
        </div>
      </div>
    </div>
  );
}
