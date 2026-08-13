import type { Metadata } from "next";
import { Users, Mail, Phone } from "lucide-react";
import { requireBusiness } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import type { Customer } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.customers.metaTitle };
}

export default async function CustomersPage() {
  const { membership } = await requireBusiness();
  const supabase = await createClient();
  const dict = await getDictionary(await getLocale());
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", membership.business.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const customers = (data ?? []) as Customer[];

  const consented = customers.filter((c) => c.marketing_consent).length;

  return (
    <>
      <PageHeader
        title={dict.dashboard.customers.title}
        description={dict.dashboard.customers.description}
        action={
          <Badge variant="secondary">
            {interpolate(dict.dashboard.customers.optedIn, {
              count: consented,
            })}
          </Badge>
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={dict.dashboard.customers.empty.title}
          description={dict.dashboard.customers.empty.description}
        />
      ) : (
        <Card>
          <CardContent className="divide-border divide-y p-0">
            {customers.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {c.full_name ?? dict.common.anonymous}
                  </p>
                  <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3.5" />
                        {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3.5" />
                        {c.phone}
                      </span>
                    )}
                  </div>
                </div>
                {c.marketing_consent ? (
                  <Badge variant="success">
                    {dict.dashboard.customers.optedInBadge}
                  </Badge>
                ) : (
                  <Badge variant="muted">
                    {dict.dashboard.customers.noConsentBadge}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
