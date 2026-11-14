import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AUTOMATION_TYPES } from "@/lib/automations/config";
import { conversionPercent, getAttribution } from "@/lib/attribution";
import { interpolate } from "@stamply/i18n/format";
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
  const { byAutomation } = await getAttribution(supabase, membership.business);

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
              {(() => {
                const stats = byAutomation.get(byType.get(type)?.id ?? "");
                return stats?.sent ? (
                  <p className="text-muted-foreground text-sm">
                    {interpolate(dict.dashboard.rewards.stats.line, {
                      ...stats,
                      rate: conversionPercent(stats),
                    })}
                  </p>
                ) : null;
              })()}
              <AutomationForm
                type={type}
                definition={byType.get(type) ?? null}
                hasReviewUrl={!!membership.business.google_review_url}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
