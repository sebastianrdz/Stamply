import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Card } from "@/types/database";
import {
  newBarcodeValue,
  newPassAuthToken,
  newAppleSerial,
} from "@/lib/tokens";

type Client = SupabaseClient<Database>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Per-type starting values for a new card (coupon expiry, membership tier/validity). */
function initialState(
  program: { type: string; config?: Record<string, unknown> | null } | null,
): { expires_at?: string; tier?: string | null; valid_until?: string | null } {
  const config = program?.config ?? {};
  const inDays = (n: unknown) =>
    typeof n === "number" && n >= 1
      ? new Date(Date.now() + n * DAY_MS).toISOString()
      : null;

  if (program?.type === "coupon") {
    const expires = inDays(config.valid_days);
    return expires ? { expires_at: expires } : {};
  }
  if (program?.type === "membership") {
    const tiers = Array.isArray(config.tiers) ? config.tiers : [];
    const first = tiers[0] as { name?: unknown } | undefined;
    return {
      tier: typeof first?.name === "string" ? first.name : null,
      // Staff-activated memberships stay pending (null) until renew/activate.
      valid_until: config.access === "free" ? inDays(config.renew_days) : null,
    };
  }
  return {};
}

/**
 * Create a loyalty card for a customer under a program. Generates the opaque
 * barcode value (scanned at checkout), the pass auth token (authorizes the card
 * page + Apple pass web service), and the Apple serial. Google object id is set
 * later when the Google pass is generated.
 */
export async function issueCard(
  supabase: Client,
  params: { businessId: string; programId: string; customerId: string },
): Promise<Card> {
  const { data: program } = await supabase
    .from("programs")
    .select("type, config")
    .eq("id", params.programId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("cards")
    .insert({
      business_id: params.businessId,
      program_id: params.programId,
      customer_id: params.customerId,
      barcode_value: newBarcodeValue(),
      pass_auth_token: newPassAuthToken(),
      apple_serial: newAppleSerial(),
      ...initialState(program),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to issue card");
  }
  return data as Card;
}
