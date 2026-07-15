import { notFound } from "next/navigation";
import { Gift } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandStyle } from "@/lib/brand";
import { Card, CardContent } from "@/components/ui/card";
import type { Business, Program } from "@/types/database";
import { EnrollForm } from "./enroll-form";

export default async function JoinPage({
  params,
}: PageProps<"/c/join/[programId]">) {
  const { programId } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("programs")
    .select("*, business:businesses(*)")
    .eq("id", programId)
    .single();

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
            Join the loyalty club
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
                  ? `Collect ${program.goal} points`
                  : `Collect ${program.goal} stamps`}
              </p>
            </div>
          </CardContent>
        </Card>

        <EnrollForm programId={program.id} />

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Powered by Stamply
        </p>
      </div>
    </div>
  );
}
