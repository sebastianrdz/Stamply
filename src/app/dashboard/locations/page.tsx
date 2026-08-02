import type { Metadata } from "next";
import { MapPin, Trash2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { deleteLocation } from "@/lib/locations/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocationForm } from "./location-form";
import type { Location } from "@/types/database";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  const { membership } = await requireRole(["owner", "admin"]);
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
        title="Locations"
        description="Add store locations so cards surface on the lock screen when customers are nearby."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add a location</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationForm />
          <p className="text-muted-foreground mt-3 text-xs">
            Latitude &amp; longitude power proximity relevance in Apple &amp;
            Google Wallet. Leave blank if you only want it for your records.
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
                    {l.address ?? "No address"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {l.lat != null && l.lng != null ? (
                  <Badge variant="success">Geo enabled</Badge>
                ) : (
                  <Badge variant="muted">No coordinates</Badge>
                )}
                <form action={deleteLocation.bind(null, l.id)}>
                  <button
                    aria-label="Delete location"
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
