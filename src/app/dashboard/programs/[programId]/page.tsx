import Image from "next/image";
import { notFound } from "next/navigation";
import { Gift, Users } from "lucide-react";
import { requireBusiness } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { qrDataUrl } from "@/lib/qr";
import { enrollUrl } from "@/lib/urls";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import type { Program } from "@/types/database";

export default async function ProgramDetailPage({
  params,
}: PageProps<"/dashboard/programs/[programId]">) {
  const { programId } = await params;
  const { membership } = await requireBusiness();
  const supabase = await createClient();

  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .eq("business_id", membership.business.id)
    .single();
  if (!data) notFound();
  const program = data as Program;

  const [{ count: cardCount }, url] = await Promise.all([
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id),
    Promise.resolve(enrollUrl(program.id)),
  ]);
  const qr = await qrDataUrl(url);

  return (
    <>
      <PageHeader
        title={program.name}
        description={
          program.type === "points"
            ? `Collect ${program.goal} points`
            : `Collect ${program.goal} stamps`
        }
        action={
          <Badge variant={program.active ? "success" : "muted"}>
            {program.active ? "Active" : "Paused"}
          </Badge>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enrollment QR</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="border-border rounded-xl border bg-white p-3">
              <Image
                src={qr}
                alt="Enrollment QR code"
                width={240}
                height={240}
                unoptimized
              />
            </div>
            <p className="text-muted-foreground text-center text-sm">
              Print this and place it at your counter. Customers scan it to join
              and add their card to their wallet.
            </p>
            <CopyButton value={url} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="bg-primary/10 text-primary grid size-11 place-items-center rounded-lg">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Cards issued</p>
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
                <p className="text-muted-foreground text-sm">Reward</p>
                <p className="font-medium">{program.reward_description}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
