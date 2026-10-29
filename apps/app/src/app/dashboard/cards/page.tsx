import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { ProgramsToastListener } from "./programs-toast-listener";
import type { Program, ProgramType } from "@/types/database";
import { enrollUrl } from "@/lib/urls";
import { ProgramCard } from "./program-card";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.programs.list.metaTitle };
}

export default async function ProgramsPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("business_id", membership.business.id)
    .order("created_at", { ascending: false });

  const programs = (data ?? []) as Program[];

  const f = dict.dashboard.programs.form;
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {programs.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              business={membership.business}
              dict={dict}
              locale={locale}
              typeLabel={typeLabel[p.type]}
              enrollUrl={enrollUrl(p.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
