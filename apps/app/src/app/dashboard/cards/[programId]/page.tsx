import Image from "next/image";
import { programTagline } from "@/lib/programs/tagline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil, Printer } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { qrDataUrl } from "@/lib/qr";
import { enrollUrl } from "@/lib/urls";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import { buttonVariants } from "@stamply/ui/button";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@stamply/ui/utils";
import { DeleteProgramDialog } from "./delete-program-dialog";
import { DownloadQrButton } from "./download-qr-button";
import { ProgramActiveToggle } from "./program-active-toggle";
import { ProgramsToastListener } from "../programs-toast-listener";
import type { Card as CardRow, Program, ProgramType } from "@/types/database";
import { programRules, programStats } from "@/lib/programs/summary";
import { ProgramPreview } from "../program-preview";

/** `${name}-qr.png`-style filename, e.g. "café-loyalty-qr.png". */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function ProgramDetailPage({
  params,
}: PageProps<"/dashboard/cards/[programId]">) {
  const { programId } = await params;
  const { membership } = await requireRole(["owner", "admin"]);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
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
  const [{ data: cardRows }, qr, qrForDownload] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "program_id, rewards, points, points_redeemed, uses_count, valid_until",
      )
      .eq("program_id", program.id),
    qrDataUrl(url),
    // A separate, higher-resolution render for the "download QR" button —
    // the on-screen one stays small since it's only ever shown at 240px.
    qrDataUrl(url, { width: 1024 }),
  ]);

  const cards = (cardRows ?? []) as Pick<
    CardRow,
    | "program_id"
    | "rewards"
    | "points"
    | "points_redeemed"
    | "uses_count"
    | "valid_until"
  >[];
  const cardCount = cards.length;
  const t = dict.dashboard.programs.detail;
  const f = dict.dashboard.programs.form;
  const typeLabel: Record<ProgramType, string> = {
    stamp: f.typeStamp,
    points: f.typePoints,
    coupon: f.typeCoupon,
    membership: f.typeMembership,
  };
  const details = [
    { label: t.name, value: program.name },
    { label: t.type, value: typeLabel[program.type] },
    {
      label: t.created,
      value: new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(program.created_at)),
    },
    ...programRules(program, dict.dashboard.programs.list.details),
  ];
  const stats = programStats(
    program,
    cards,
    dict.dashboard.programs.list.details,
  );

  return (
    <>
      <ProgramsToastListener />
      <PageHeader
        title={program.name}
        description={programTagline(program, dict.programTagline)}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={program.active ? "success" : "muted"}>
              {program.active
                ? dict.dashboard.programs.list.active
                : dict.dashboard.programs.list.paused}
            </Badge>
            <Link
              href={`/dashboard/cards/${program.id}/edit`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-2",
              )}
            >
              <Pencil className="size-4" />
              {dict.dashboard.programs.detail.editCta}
            </Link>
            <ProgramActiveToggle
              programId={program.id}
              active={program.active}
            />
            <DeleteProgramDialog
              programId={program.id}
              programName={program.name}
              active={program.active}
              cardCount={cardCount}
            />
          </div>
        }
      />

      <p className="text-muted-foreground -mt-4 mb-6 text-sm">
        {dict.dashboard.programs.detail.disableHint}
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-border divide-y text-sm">
              {[...details, ...stats].map((r) => (
                <div key={r.label} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{r.label}</dt>
                  <dd className="text-right font-medium">{r.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="mx-auto w-full max-w-[16rem]">
          <ProgramPreview
            program={program}
            business={membership.business}
            dict={dict}
            locale={locale}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t.joinLinkTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <code className="border-border w-full truncate rounded-lg border px-3 py-2 font-mono text-xs">
              {url}
            </code>
            <div className="border-border rounded-xl border bg-white p-2">
              <Image
                src={qr}
                alt={t.qrAlt}
                width={180}
                height={180}
                unoptimized
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <CopyButton value={url} />
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={t.openLink}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ExternalLink className="size-4" />
              </a>
              <DownloadQrButton
                dataUrl={qrForDownload}
                filename={`${slugify(program.name)}-qr.png`}
              />
              <Link
                href={`/dashboard/marketing?card=${program.id}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-2",
                )}
              >
                <Printer className="size-4" />
                {dict.dashboard.marketing.title}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
