import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProgramForm } from "@/app/dashboard/programs/new/program-form";
import type { Program } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.programs.edit.metaTitle };
}

export default async function EditProgramPage({
  params,
}: PageProps<"/dashboard/programs/[programId]/edit">) {
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
      <ProgramForm program={program} />
    </>
  );
}
