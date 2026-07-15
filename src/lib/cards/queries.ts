import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Card,
  Program,
  Business,
  Customer,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export interface CardWithRelations extends Card {
  program: Program;
  business: Business;
  customer: Customer;
}

const SELECT =
  "*, program:programs(*), business:businesses(*), customer:customers(*)";

async function fetchOne(
  supabase: Client,
  column: "pass_auth_token" | "barcode_value",
  value: string,
): Promise<CardWithRelations | null> {
  const { data } = await supabase
    .from("cards")
    .select(SELECT)
    .eq(column, value)
    .maybeSingle();
  return (data as unknown as CardWithRelations) ?? null;
}

/** Load a card (with relations) by its pass auth token — used by card page + passes. */
export function getCardByToken(supabase: Client, token: string) {
  return fetchOne(supabase, "pass_auth_token", token);
}

/** Load a card (with relations) by its scannable barcode value — used by scan. */
export function getCardByBarcode(supabase: Client, barcode: string) {
  return fetchOne(supabase, "barcode_value", barcode);
}

/** Progress value (stamps or points) for a card given its program. */
export function cardProgress(
  card: Pick<Card, "stamps" | "points">,
  program: Pick<Program, "type">,
) {
  return program.type === "points" ? card.points : card.stamps;
}
