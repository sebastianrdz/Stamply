import type { Metadata } from "next";
import Link from "next/link";
import { Printer } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { qrDataUrl } from "@/lib/qr";
import { enrollUrl } from "@/lib/urls";
import { cardDesign } from "@/lib/programs/design";
import { fetchAsDataUrl } from "@/lib/images";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { buttonVariants } from "@stamply/ui/button";
import { cn } from "@stamply/ui/utils";
import { TemplatesSection } from "./templates/templates-section";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.marketing.metaTitle };
}

export default async function MarketingPage({
  searchParams,
}: PageProps<"/dashboard/marketing">) {
  const { card } = await searchParams;
  const { membership } = await requireRole(["owner", "admin"]);
  const dict = await getDictionary(await getLocale());
  const m = dict.dashboard.marketing;
  const business = membership.business;

  const supabase = await createClient();
  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, type, reward_description, design")
    .eq("business_id", business.id)
    .order("created_at");
  const list = programs ?? [];
  const selected =
    list.find((p) => p.id === (Array.isArray(card) ? card[0] : card)) ??
    list[0];

  const design = selected ? cardDesign(selected, business) : null;
  const [qr, logo, background] = selected && design
    ? await Promise.all([
        qrDataUrl(enrollUrl(selected.id)),
        // Inlined so the SVG -> canvas -> PNG download keeps the images
        // (see src/lib/images.ts).
        fetchAsDataUrl(design.logo_url),
        fetchAsDataUrl(design.background_image_url),
      ])
    : [];

  return (
    <>
      <PageHeader title={m.title} description={m.description} />
      {!selected || !qr ? (
        <EmptyState icon={Printer} title={m.title} description={m.empty} />
      ) : (
        <>
          <nav aria-label={m.pickCard} className="mb-6 flex flex-wrap gap-2">
            {list.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/marketing?card=${p.id}`}
                className={cn(
                  buttonVariants({
                    variant: p.id === selected.id ? "primary" : "outline",
                    size: "sm",
                  }),
                )}
              >
                {p.name}
              </Link>
            ))}
          </nav>
          <TemplatesSection
            program={{
              name: selected.name,
              type: selected.type,
              reward_description: selected.reward_description,
            }}
            business={{
              name: business.name,
              brand_primary_color: design!.primary_color,
              brand_secondary_color: design!.secondary_color,
              logo_url: logo ?? null,
              background_image_url: background ?? null,
              show_business_name: design!.show_business_name,
            }}
            qrDataUrl={qr}
          />
        </>
      )}
    </>
  );
}
