import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireBusiness } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@stamply/ui/badge";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import { CustomerList } from "./customer-list";
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
        <CustomerList
          customers={customers}
          canSend={membership.role !== "employee"}
        />
      )}
    </>
  );
}
