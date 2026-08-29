import Link from "next/link";
import { Gift, CreditCard } from "lucide-react";
import { Card, CardContent } from "@stamply/ui/card";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { interpolate } from "@stamply/i18n/format";
import type { Dictionary } from "@stamply/i18n/dictionaries";
import type { Locale } from "@stamply/i18n/config";
import type { StandaloneReward } from "@/lib/rewards/queries";
import type { ActiveProgramSummary } from "@/lib/cards/queries";

/**
 * "What's new for this customer" block on the card page: standalone rewards
 * (e.g. an unredeemed birthday reward) plus a summary of the customer's other
 * active programs at this same business. Always renders both subsections —
 * list-or-empty-state — never hidden entirely, so the section's presence/
 * layout doesn't jump around based on data.
 */
export function NotificationsSection({
  dict,
  locale,
  standaloneRewards,
  otherPrograms,
}: {
  dict: Dictionary;
  locale: Locale;
  standaloneRewards: StandaloneReward[];
  otherPrograms: ActiveProgramSummary[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        {dict.card.notifications.title}
      </h2>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <AvailableRewardsList
            rewards={standaloneRewards}
            dict={dict}
            locale={locale}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <ActiveProgramsList programs={otherPrograms} dict={dict} />
        </CardContent>
      </Card>
    </div>
  );
}

function AvailableRewardsList({
  rewards,
  dict,
  locale,
}: {
  rewards: StandaloneReward[];
  dict: Dictionary;
  locale: Locale;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">
        {dict.card.notifications.availableRewards.title}
      </h3>
      {rewards.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {dict.card.notifications.availableRewards.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rewards.map((reward) => (
            <li key={reward.id} className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))]">
                <Gift className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {reward.title}
                </p>
                {reward.validUntil && (
                  <p className="text-muted-foreground text-xs">
                    {interpolate(
                      dict.card.notifications.availableRewards.validUntil,
                      {
                        date: new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(new Date(reward.validUntil)),
                      },
                    )}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActiveProgramsList({
  programs,
  dict,
}: {
  programs: ActiveProgramSummary[];
  dict: Dictionary;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">
        {dict.card.notifications.activePrograms.title}
      </h3>
      {programs.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {dict.card.notifications.activePrograms.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {programs.map((program) => (
            <li key={program.cardId} className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[hsl(var(--brand))]/12 text-[hsl(var(--brand))]">
                <CreditCard className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {program.programName}
                </p>
                <p className="text-muted-foreground text-xs">
                  {program.progress}/{program.goal}
                </p>
                {program.rewardsAvailable > 0 && (
                  <span className="bg-accent/15 text-accent-foreground mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                    <Gift className="size-3" />
                    {dict.card.notifications.activePrograms.rewardReady}
                  </span>
                )}
              </div>
              <Link
                href={`/c/${program.token}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "shrink-0",
                )}
              >
                {dict.card.notifications.activePrograms.viewCard}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
