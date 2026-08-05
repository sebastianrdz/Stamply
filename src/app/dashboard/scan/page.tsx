import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Scanner } from "./scanner";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.scan.metaTitle };
}

export default async function ScanPage() {
  await requireBusiness();
  const dict = await getDictionary(await getLocale());
  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title={dict.dashboard.scan.title}
        description={dict.dashboard.scan.description}
      />
      <Scanner />
    </div>
  );
}
