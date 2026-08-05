import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift, Users, Pencil } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { interpolate } from "@/lib/i18n/format";
import { qrDataUrl } from "@/lib/qr";
import { enrollUrl } from "@/lib/urls";
import { fetchAsDataUrl } from "@/lib/images";
import { toggleProgramActive } from "@/lib/programs/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";
import { DeleteProgramDialog } from "./delete-program-dialog";
import { DownloadQrButton } from "./download-qr-button";
import { TemplatesSection } from "./templates/templates-section";
import type { Program } from "@/types/database";

/** `${name}-qr.png`-style filename, e.g. "café-loyalty-qr.png". */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function ProgramDetailPage({
  params,
}: PageProps<"/dashboard/programs/[programId]">) {
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

  const url = enrollUrl(program.id);
  const [
    { count: cardCount },
    qr,
    qrForDownload,
    logoDataUrl,
    backgroundDataUrl,
  ] = await Promise.all([
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id),
    qrDataUrl(url),
    // A separate, higher-resolution render for the "download QR" button —
    // the on-screen one stays small since it's only ever shown at 240px.
    qrDataUrl(url, { width: 1024 }),
    // Inlined server-side (no CORS restriction here) so the printable
    // templates can embed the logo/background as `<image href="data:...">`
    // — a remote http(s) href is not fetched by the browser in the SVG →
    // canvas download pipeline (see src/lib/images.ts), which is why a
    // real download showed a broken logo and no background.
    fetchAsDataUrl(membership.business.logo_url),
    fetchAsDataUrl(membership.business.background_image_url),
  ]);

  return (
    <>
      <PageHeader
        title={program.name}
        description={
          program.type === "points"
            ? interpolate(dict.dashboard.programs.detail.collectPoints, {
                goal: program.goal,
              })
            : interpolate(dict.dashboard.programs.detail.collectStamps, {
                goal: program.goal,
              })
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={program.active ? "success" : "muted"}>
              {program.active
                ? dict.dashboard.programs.list.active
                : dict.dashboard.programs.list.paused}
            </Badge>
            <Link
              href={`/dashboard/programs/${program.id}/edit`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-2",
              )}
            >
              <Pencil className="size-4" />
              {dict.dashboard.programs.detail.editCta}
            </Link>
            <form
              action={toggleProgramActive.bind(
                null,
                program.id,
                !program.active,
              )}
            >
              <Button type="submit" variant="outline" size="sm">
                {program.active
                  ? dict.dashboard.programs.detail.disableCta
                  : dict.dashboard.programs.detail.enableCta}
              </Button>
            </form>
          </div>
        }
      />

      <p className="text-muted-foreground -mt-4 mb-6 text-sm">
        {dict.dashboard.programs.detail.disableHint}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{dict.dashboard.programs.detail.enrollmentQr}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="border-border rounded-xl border bg-white p-3">
              <Image
                src={qr}
                alt={dict.dashboard.programs.detail.qrAlt}
                width={240}
                height={240}
                unoptimized
              />
            </div>
            <p className="text-muted-foreground text-center text-sm">
              {dict.dashboard.programs.detail.printHint}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <CopyButton value={url} />
              <DownloadQrButton
                dataUrl={qrForDownload}
                filename={`${slugify(program.name)}-qr.png`}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="bg-primary/10 text-primary grid size-11 place-items-center rounded-lg">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">
                  {dict.dashboard.programs.detail.cardsIssued}
                </p>
                <p className="text-2xl font-bold">{cardCount ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 p-6">
              <div className="bg-accent/15 text-accent-foreground grid size-11 place-items-center rounded-lg">
                <Gift className="size-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">
                  {dict.dashboard.programs.detail.reward}
                </p>
                <p className="font-medium">{program.reward_description}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <TemplatesSection
          program={{
            name: program.name,
            reward_description: program.reward_description,
          }}
          business={{
            name: membership.business.name,
            brand_primary_color: membership.business.brand_primary_color,
            brand_secondary_color: membership.business.brand_secondary_color,
            // Inlined data URLs (or null on absent/failed fetch, same as the
            // raw fields) — see the fetchAsDataUrl calls above for why raw
            // remote URLs don't survive the templates' SVG → canvas → PNG
            // download pipeline.
            logo_url: logoDataUrl,
            background_image_url: backgroundDataUrl,
            show_business_name: membership.business.show_business_name,
          }}
          qrDataUrl={qr}
        />
      </div>

      <Card className="border-destructive/30 mt-8">
        <CardHeader>
          <CardTitle>
            {dict.dashboard.programs.detail.deleteSectionTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            {dict.dashboard.programs.detail.deleteSectionDescription}
          </p>
          <DeleteProgramDialog
            programId={program.id}
            programName={program.name}
            active={program.active}
            cardCount={cardCount ?? 0}
          />
        </CardContent>
      </Card>
    </>
  );
}
