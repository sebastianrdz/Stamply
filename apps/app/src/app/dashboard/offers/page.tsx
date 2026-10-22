import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@stamply/ui/card";
import { Badge } from "@stamply/ui/badge";
import { OfferForm } from "./offer-form";
import type { WalletOffer } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.offers.metaTitle };
}

export default async function OffersPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const locale = await getLocale();
  const dict = (await getDictionary(locale)).dashboard.offers;
  const supabase = await createClient();
  const { data } = await supabase
    .from("wallet_offers")
    .select("*")
    .eq("business_id", membership.business.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const offers = (data ?? []) as WalletOffer[];

  return (
    <>
      <PageHeader title={dict.title} description={dict.description} />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{dict.composeTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.historyTitle}</CardTitle>
        </CardHeader>
        <CardContent className="divide-border divide-y p-0">
          {offers.length === 0 ? (
            <p className="text-muted-foreground px-5 py-4 text-sm">
              {dict.historyEmpty}
            </p>
          ) : (
            offers.map((o) => (
              <div
                key={o.id}
                className="flex items-start justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="break-words">{o.body}</p>
                  <p className="text-muted-foreground text-sm">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: membership.business.timezone,
                    }).format(new Date(o.created_at))}
                  </p>
                </div>
                <Badge variant="secondary">
                  {o.customer_id ? dict.audienceOne : dict.audienceAll}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
