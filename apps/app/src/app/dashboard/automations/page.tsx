import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AUTOMATION_TYPES } from "@/lib/automations/config";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { AutomationForm } from "./automation-form";
import type { RewardDefinition } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.rewards.metaTitle };
}

export default async function AutomationsPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const dict = await getDictionary(await getLocale());
  const supabase = await createClient();

  const { data } = await supabase
    .from("reward_definitions")
    .select("*")
    .eq("business_id", membership.business.id);
  const byType = new Map(
    ((data ?? []) as RewardDefinition[]).map((d) => [d.type, d]),
  );

  return (
    <>
      <PageHeader
        title={dict.dashboard.rewards.title}
        description={dict.dashboard.rewards.description}
      />
      <div className="flex flex-col gap-4">
        {AUTOMATION_TYPES.map((type) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{dict.dashboard.rewards.types[type].title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <p className="text-muted-foreground text-sm">
                {dict.dashboard.rewards.types[type].description}
              </p>
              <AutomationForm type={type} definition={byType.get(type) ?? null} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
