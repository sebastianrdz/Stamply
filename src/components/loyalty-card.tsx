import Image from "next/image";
import { Stamp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Program } from "@/types/database";

/** Visual representation of a stamp/points card, themed by --brand. */
export function LoyaltyCard({
  businessName,
  program,
  progress,
  completed,
  logoUrl,
  backgroundImageUrl,
  showBusinessName = true,
  rewardReadyLabel,
  yourRewardLabel,
}: {
  businessName: string;
  program: Pick<Program, "name" | "type" | "goal" | "reward_description">;
  progress: number;
  completed: boolean;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  showBusinessName?: boolean;
  /** Localized copy — this is a server component with no dictionary access
   *  of its own, so the caller passes the already-resolved strings. */
  rewardReadyLabel: string;
  yourRewardLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[hsl(var(--brand))] text-white shadow-lg">
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <Image
              src={logoUrl}
              alt={`${businessName} logo`}
              width={40}
              height={40}
              unoptimized
              className="size-10 shrink-0 rounded-lg bg-white/90 object-contain p-0.5"
            />
          )}
          <div>
            {showBusinessName && (
              <p className="text-sm/5 font-medium opacity-90">{businessName}</p>
            )}
            <h2 className="text-lg font-bold">{program.name}</h2>
          </div>
        </div>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
          {completed ? rewardReadyLabel : `${progress}/${program.goal}`}
        </span>
      </div>

      <div className="relative bg-black/10 p-5">
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
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: program.goal }).map((_, i) => (
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
              ))}
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

      <div className="p-5 pt-4 text-sm">
        <p className="opacity-90">{yourRewardLabel}</p>
        <p className="font-semibold">{program.reward_description}</p>
      </div>
    </div>
  );
}
