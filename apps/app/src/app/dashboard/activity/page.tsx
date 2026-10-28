import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  CheckCheck,
  CreditCard,
  Gift,
  Megaphone,
  Zap,
  PartyPopper,
  SlidersHorizontal,
  Stamp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchActivity } from "@/lib/activity/queries";
import { parseFilters } from "@/lib/activity/paginate";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@stamply/ui/card";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import type { ActivityType } from "@/types/database";

const ICONS: Record<ActivityType, LucideIcon> = {
  customer_joined: UserPlus,
  card_issued: CreditCard,
  stamp: Stamp,
  checkin: CheckCheck,
  redeem: Gift,
  adjust: SlidersHorizontal,
  reward_granted: PartyPopper,
  reward_redeemed: Gift,
  broadcast: Megaphone,
  automation_sent: Zap,
};

const FILTER_TYPES = [
  "customer_joined",
  "card_issued",
  "stamp",
  "checkin",
  "redeem",
  "reward_granted",
  "reward_redeemed",
  "broadcast",
  "automation_sent",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.activity.metaTitle };
}

export default async function ActivityPage({
  searchParams,
}: PageProps<"/dashboard/activity">) {
  const filters = parseFilters(await searchParams);
  const { membership } = await requireRole(["owner", "admin"]);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const a = dict.dashboard.activity;
  const supabase = await createClient();
  const { items, nextCursor } = await fetchActivity(
    supabase,
    membership.business.id,
    filters,
  );
  const fmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: membership.business.timezone,
  });

  // Filters other than the cursor survive "load older" and chip clicks.
  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { ...filters, cursor: undefined, ...over };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/dashboard/activity${qs ? `?${qs}` : ""}`;
  };

  const chip = (active: boolean) =>
    cn(
      buttonVariants({ variant: active ? "primary" : "outline", size: "sm" }),
    );

  function describe(r: (typeof items)[number]) {
    const events = a.events as Record<string, string>;
    const key =
      r.type === "broadcast" && !r.customer_id ? "broadcastAll" : r.type;
    return interpolate(events[key], {
      customer: r.customer_name ?? a.aCustomer,
      program: r.program_name ?? "",
      detail: r.detail ?? "",
      delta: r.delta != null && r.delta > 0 ? `+${r.delta}` : String(r.delta ?? ""),
    });
  }

  return (
    <>
      <PageHeader title={a.title} description={a.description} />

      <nav aria-label={a.filterLabel} className="mb-4 flex flex-wrap gap-2">
        <Link
          href={href({ type: undefined })}
          className={chip(!filters.type)}
          aria-current={!filters.type ? "true" : undefined}
        >
          {a.filterAll}
        </Link>
        {FILTER_TYPES.map((t) => (
          <Link
            key={t}
            href={href({ type: t })}
            className={chip(filters.type === t)}
            aria-current={filters.type === t ? "true" : undefined}
          >
            {a.types[t]}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={a.empty.title}
          description={a.empty.description}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {items.map((r) => {
                const Icon = ICONS[r.type] ?? Activity;
                return (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-full">
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-sm break-words">{describe(r)}</p>
                      <time
                        dateTime={r.occurred_at}
                        className="text-muted-foreground text-xs"
                      >
                        {fmt.format(new Date(r.occurred_at))}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <Link
            href={href({ cursor: nextCursor })}
            className={buttonVariants({ variant: "outline" })}
          >
            {a.loadOlder}
          </Link>
        </div>
      )}
    </>
  );
}
