import Link from "next/link";
import { Card } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import type { Dictionary } from "@stamply/i18n/dictionaries";
import { CopyButton } from "@/components/copy-button";
import type { BusinessBrand } from "@/lib/programs/design";
import { ProgramPreview } from "./program-preview";
import { programTagline } from "@/lib/programs/tagline";
import type { Program } from "@/types/database";

/** Program tile: wallet-card preview on top, name/status/share below. Links to the detail page. */
export function ProgramCard({
  program: p,
  business,
  dict,
  locale,
  typeLabel,
  enrollUrl,
}: {
  program: Program;
  business: BusinessBrand & { name: string };
  dict: Dictionary;
  locale: string;
  typeLabel: string;
  enrollUrl: string;
}) {
  const l = dict.dashboard.programs.list;
  return (
    <Card className="relative flex flex-col overflow-hidden shadow group duration-300 transition-all ">
      <div className="bg-muted/80 p-4 pb-0! sm:p-6">
        <div className="mx-auto w-full max-w-[16rem]">
          <ProgramPreview
            program={p}
            business={business}
            dict={dict}
            locale={locale}
            barcode={null}
            halfView
            className="shadow-none group-hover:scale-110 duration-300 transition-all"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">
            {/* Stretched link: the whole tile opens the program; the copy button sits above it. */}
            <Link
              href={`/dashboard/cards/${p.id}`}
              className="after:absolute after:inset-0"
            >
              {p.name}
            </Link>
          </h3>
          <p className="text-muted-foreground text-sm">
            {programTagline(p, dict.programTagline)}
          </p>
        </div>
        <div className="relative z-10 w-fit">
          <CopyButton value={enrollUrl} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <Badge variant={p.active ? "success" : "muted"}>
            {p.active ? l.active : l.paused}
          </Badge>
          <Badge variant="muted" className="uppercase">
            {typeLabel}
          </Badge>
          <span className="text-muted-foreground ml-auto text-xs">
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
              new Date(p.created_at),
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
