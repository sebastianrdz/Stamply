import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProgramForm } from "./program-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.programs.new.metaTitle };
}

export default async function NewProgramPage() {
  await requireRole(["owner", "admin"]);
  const dict = await getDictionary(await getLocale());
  return (
    <>
      <PageHeader
        title={dict.dashboard.programs.new.title}
        description={dict.dashboard.programs.new.description}
      />
      <ProgramForm />
    </>
  );
}
