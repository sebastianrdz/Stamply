import type { Metadata } from "next";
import { Users, Mail, Phone } from "lucide-react";
import { requireBusiness } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Customer } from "@/types/database";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const { membership } = await requireBusiness();
  const supabase = await createClient();
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
        title="Customers"
        description="Everyone who joined your loyalty program."
        action={
          <Badge variant="secondary">{consented} opted in to marketing</Badge>
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Share a program's enrollment QR to start collecting members."
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
                    {c.full_name ?? "Anonymous"}
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
                  <Badge variant="success">Opted in</Badge>
                ) : (
                  <Badge variant="muted">No consent</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
