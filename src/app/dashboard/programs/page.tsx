import Link from "next/link";
import { CreditCard, Plus, Gift } from "lucide-react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Program } from "@/types/database";

export const metadata: Metadata = { title: "Programs" };

export default async function ProgramsPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("business_id", membership.business.id)
    .order("created_at", { ascending: false });

  const programs = (data ?? []) as Program[];

  return (
    <>
      <PageHeader
        title="Loyalty programs"
        description="Create the reward cards your customers collect."
        action={
          <Link
            href="/dashboard/programs/new"
            className={cn(buttonVariants(), "gap-2")}
          >
            <Plus className="size-4" />
            New program
          </Link>
        }
      />

      {programs.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No programs yet"
          description="A program defines how customers earn a reward — like 'buy 9 coffees, get the 10th free'."
          action={
            <Link
              href="/dashboard/programs/new"
              className={cn(buttonVariants(), "gap-2")}
            >
              <Plus className="size-4" />
              Create your first program
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{p.name}</h3>
                  <Badge variant={p.active ? "success" : "muted"}>
                    {p.active ? "Active" : "Paused"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {p.type === "points"
                    ? `Collect ${p.goal} points`
                    : `Collect ${p.goal} stamps`}
                </p>
                <div className="bg-accent/10 text-accent-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                  <Gift className="size-4 shrink-0" />
                  {p.reward_description}
                </div>
                <Link
                  href={`/dashboard/programs/${p.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-1 w-full",
                  )}
                >
                  Manage &amp; get enrollment QR
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
