import { notFound } from "next/navigation";
import { Gift } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandStyle } from "@/lib/brand";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { Card, CardContent } from "@stamply/ui/card";
import type { Business, Program } from "@/types/database";
import { EnrollForm } from "./enroll-form";

export default async function JoinPage({
  params,
}: PageProps<"/c/join/[programId]">) {
  const { programId } = await params;
  const dict = await getDictionary(await getLocale());
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("programs")
    .select("*, business:businesses(*)")
    .eq("id", programId)
    .single();

  // `.single()` reports PGRST116 ("no rows"/"multiple rows") for the genuine
  // not-found case — that's the only error code that should route to
  // `notFound()`. Anything else is a real backend failure, not a missing
  // program.
  if (error && error.code !== "PGRST116") {
    console.error(`[c/join] program lookup failed for programId=${programId}`, error);
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Card>
            <CardContent className="flex flex-col gap-1 p-6 text-center">
              <h1 className="text-lg font-semibold">
                {dict.customerJoin.error.title}
              </h1>
              <p className="text-muted-foreground text-sm">
                {dict.customerJoin.error.description}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  if (!data) notFound();
  const program = data as unknown as Program & { business: Business };
  const business = program.business;

  return (
    <div
      className="flex min-h-full flex-col items-center justify-center px-6 py-12"
      style={brandStyle(business)}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-[hsl(var(--brand))]">
            {business.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {dict.customerJoin.title}
          </h1>
        </div>

        <Card className="mb-5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid size-10 place-items-center rounded-lg bg-[hsl(var(--brand))]/12 text-[hsl(var(--brand))]">
              <Gift className="size-5" />
            </div>
            <div className="text-sm">
              <p className="font-medium">{program.reward_description}</p>
              <p className="text-muted-foreground">
                {program.type === "points"
                  ? interpolate(dict.customerJoin.collectPoints, {
                      goal: program.goal,
                    })
                  : interpolate(dict.customerJoin.collectStamps, {
                      goal: program.goal,
                    })}
              </p>
            </div>
          </CardContent>
        </Card>

        <EnrollForm programId={program.id} />

        <p className="text-muted-foreground mt-6 text-center text-xs">
          {dict.common.poweredBy}
        </p>
      </div>
    </div>
  );
}
