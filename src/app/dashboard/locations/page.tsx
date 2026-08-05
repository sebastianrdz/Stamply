import type { Metadata } from "next";
import { MapPin, Trash2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { deleteLocation } from "@/lib/locations/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocationForm } from "./location-form";
import type { Location } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return { title: dict.dashboard.locations.metaTitle };
}

export default async function LocationsPage() {
  const { membership } = await requireRole(["owner", "admin"]);
  const dict = await getDictionary(await getLocale());
  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select("*")
    .eq("business_id", membership.business.id)
    .order("created_at", { ascending: true });
  const locations = (data ?? []) as Location[];

  return (
    <>
      <PageHeader
        title={dict.dashboard.locations.title}
        description={dict.dashboard.locations.description}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{dict.dashboard.locations.addCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationForm />
          <p className="text-muted-foreground mt-3 text-xs">
            {dict.dashboard.locations.latLngHint}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {locations.map((l) => (
          <Card key={l.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary grid size-10 place-items-center rounded-lg">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <p className="font-medium">{l.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {l.address ?? dict.common.noAddress}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {l.lat != null && l.lng != null ? (
                  <Badge variant="success">
                    {dict.dashboard.locations.geoEnabled}
                  </Badge>
                ) : (
                  <Badge variant="muted">
                    {dict.dashboard.locations.noCoordinates}
                  </Badge>
                )}
                <form action={deleteLocation.bind(null, l.id)}>
                  <button
                    aria-label={dict.dashboard.locations.deleteAria}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive grid size-9 place-items-center rounded-lg"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
