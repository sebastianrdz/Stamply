import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProgramForm } from "@/app/dashboard/cards/new/program-form";
import { cardDesign } from "@/lib/programs/design";
import { listAssets } from "@/lib/assets/library";
import type { Program } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.programs.edit.metaTitle };
}

export default async function EditProgramPage({
  params,
}: PageProps<"/dashboard/cards/[programId]/edit">) {
  const { programId } = await params;
  const { membership } = await requireRole(["owner", "admin"]);
  const dict = await getDictionary(await getLocale());
  const supabase = await createClient();

  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .eq("business_id", membership.business.id)
    .single();
  if (!data) notFound();
  const program = data as Program;

  return (
    <>
      <PageHeader
        title={dict.dashboard.programs.edit.title}
        description={dict.dashboard.programs.edit.description}
      />
      <ProgramForm
        program={program}
        businessName={membership.business.name}
        design={cardDesign(program, membership.business)}
        library={await listAssets(supabase, membership.business.id)}
      />
    </>
  );
}
