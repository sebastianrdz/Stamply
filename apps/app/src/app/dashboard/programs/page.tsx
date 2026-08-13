import Link from "next/link";
import { CreditCard, Plus, Gift } from "lucide-react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import type { Program } from "@/types/database";

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

  return (
    <>
      <PageHeader
        title={dict.dashboard.programs.list.title}
        description={dict.dashboard.programs.list.description}
        action={
          <Link
            href="/dashboard/programs/new"
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
              href="/dashboard/programs/new"
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
                  <h3 className="font-semibold">{p.name}</h3>
                  <Badge variant={p.active ? "success" : "muted"}>
                    {p.active
                      ? dict.dashboard.programs.list.active
                      : dict.dashboard.programs.list.paused}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {p.type === "points"
                    ? interpolate(dict.dashboard.programs.list.collectPoints, {
                        goal: p.goal,
                      })
                    : interpolate(dict.dashboard.programs.list.collectStamps, {
                        goal: p.goal,
                      })}
                </p>
                <div className="bg-accent/10 text-accent-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                  <Gift className="size-4 shrink-0" />
                  {p.reward_description}
                </div>
                <Link
                  href={`/dashboard/programs/${p.id}`}
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
