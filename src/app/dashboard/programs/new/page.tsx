import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProgramForm } from "./program-form";

export const metadata: Metadata = { title: "New program" };

export default async function NewProgramPage() {
  await requireBusiness();
  return (
    <>
      <PageHeader
        title="New program"
        description="Set the goal and the reward customers earn."
      />
      <ProgramForm />
    </>
  );
}
