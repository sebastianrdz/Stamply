import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { ProgramsToastListener } from "./programs-toast-listener";
import type { Card as CardRow, Program, ProgramType } from "@/types/database";
import { programRules, programStats } from "@/lib/programs/summary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.programs.list.metaTitle };
}

export default async function ProgramsPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const dict = await getDictionary(await getLocale());
  const supabase = await createClient();
  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("business_id", membership.business.id)
    .order("created_at", { ascending: false });

  const programs = (data ?? []) as Program[];

  // shortcut: one query + JS aggregation, fine up to the 10k-customer plan cap; move to a SQL view/RPC beyond it.
  const { data: cardRows } = await supabase
    .from("cards")
    .select("program_id, rewards, points, points_redeemed, uses_count, valid_until")
    .eq("business_id", membership.business.id);
  const cards = (cardRows ?? []) as Pick<
    CardRow,
    "program_id" | "rewards" | "points" | "points_redeemed" | "uses_count" | "valid_until"
  >[];

  const f = dict.dashboard.programs.form;
  const d = dict.dashboard.programs.list.details;
  const typeLabel: Record<ProgramType, string> = {
    stamp: f.typeStamp,
    points: f.typePoints,
    coupon: f.typeCoupon,
    membership: f.typeMembership,
  };

  return (
    <>
      <ProgramsToastListener />
      <PageHeader
        title={dict.dashboard.programs.list.title}
        description={dict.dashboard.programs.list.description}
        action={
          <Link
            href="/dashboard/cards/new"
            className={cn(buttonVariants(), "gap-2")}
          >
            <Plus className="size-4" />
            {dict.dashboard.programs.list.newProgram}
          </Link>
        }
      />

      {programs.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={dict.dashboard.programs.list.empty.title}
          description={dict.dashboard.programs.list.empty.description}
          action={
            <Link
              href="/dashboard/cards/new"
              className={cn(buttonVariants(), "gap-2")}
            >
              <Plus className="size-4" />
              {dict.dashboard.programs.list.empty.cta}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {typeLabel[p.type]}
                    </span>
                  </div>
                  <Badge variant={p.active ? "success" : "muted"}>
                    {p.active
                      ? dict.dashboard.programs.list.active
                      : dict.dashboard.programs.list.paused}
                  </Badge>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {programRules(p, d).map((r) => (
                    <div key={r.label} className="contents">
                      <dt className="text-muted-foreground">{r.label}</dt>
                      <dd className="font-medium">{r.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="bg-accent/10 text-accent-foreground grid grid-cols-2 gap-3 rounded-lg px-3 py-2 text-sm">
                  {programStats(p, cards, d).map((r) => (
                    <div key={r.label} className="flex flex-col">
                      <span className="text-lg font-semibold leading-tight">{r.value}</span>
                      <span className="text-xs">{r.label}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/dashboard/cards/${p.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-1 w-full",
                  )}
                >
                  {dict.dashboard.programs.list.manageCta}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
