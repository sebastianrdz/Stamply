import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { BirthdayRewardForm } from "./birthday-reward-form";
import type { RewardDefinition } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.rewards.metaTitle };
}

export default async function RewardsPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const dict = await getDictionary(await getLocale());
  const supabase = await createClient();

  // Not `getBirthdayRewardDefinition` from rewards/queries.ts — that helper
  // filters `.eq("active", true)`, which would hide an existing-but-currently
  // -inactive definition from this admin edit page.
  const { data } = await supabase
    .from("reward_definitions")
    .select("*")
    .eq("business_id", membership.business.id)
    .eq("type", "birthday")
    .maybeSingle();
  const definition = data as RewardDefinition | null;

  return (
    <>
      <PageHeader
        title={dict.dashboard.rewards.title}
        description={dict.dashboard.rewards.description}
      />
      <Card>
        <CardHeader>
          <CardTitle>{dict.dashboard.rewards.birthday.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-muted-foreground text-sm">
            {dict.dashboard.rewards.birthday.description}
          </p>
          <BirthdayRewardForm definition={definition} />
        </CardContent>
      </Card>
    </>
  );
}
