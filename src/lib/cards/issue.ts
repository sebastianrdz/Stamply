import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Card } from "@/types/database";
import {
  newBarcodeValue,
  newPassAuthToken,
  newAppleSerial,
} from "@/lib/tokens";

type Client = SupabaseClient<Database>;

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
  const { data, error } = await supabase
    .from("cards")
    .insert({
      business_id: params.businessId,
      program_id: params.programId,
      customer_id: params.customerId,
      barcode_value: newBarcodeValue(),
      pass_auth_token: newPassAuthToken(),
      apple_serial: newAppleSerial(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to issue card");
  }
  return data as Card;
}
