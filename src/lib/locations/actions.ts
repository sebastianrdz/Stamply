"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  assertWithinLimit,
  LimitExceededError,
} from "@/lib/billing/entitlements";

const schema = z.object({
  name: z.string().min(1, "Name is required.").max(120),
  address: z.string().max(240).optional().or(z.literal("")),
  lat: z.coerce.number().min(-90).max(90).optional().or(z.nan()),
  lng: z.coerce.number().min(-180).max(180).optional().or(z.nan()),
});

export interface LocationFormState {
  error?: string;
}

export async function createLocation(
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const { membership } = await requireBusiness();
  const business = membership.business;

  const parsed = schema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  try {
    await assertWithinLimit(supabase, business, "locations");
  } catch (e) {
    if (e instanceof LimitExceededError) return { error: e.message };
    throw e;
  }

  const lat = Number.isNaN(parsed.data.lat) ? null : (parsed.data.lat ?? null);
  const lng = Number.isNaN(parsed.data.lng) ? null : (parsed.data.lng ?? null);

  const { error } = await supabase.from("locations").insert({
    business_id: business.id,
    name: parsed.data.name,
    address: parsed.data.address || null,
    lat,
    lng,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/locations");
  return {};
}

export async function deleteLocation(locationId: string) {
  const supabase = await createClient();
  await supabase.from("locations").delete().eq("id", locationId);
  revalidatePath("/dashboard/locations");
}
