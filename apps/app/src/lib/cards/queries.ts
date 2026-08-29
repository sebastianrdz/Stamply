import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Card,
  Program,
  Business,
  Customer,
  ProgramType,
  CardStatus,
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
  const { data, error } = await supabase
    .from("cards")
    .select(SELECT)
    .eq(column, value)
    .maybeSingle();
  if (error) {
    // NEVER log `value`: for the `pass_auth_token` column it's a live Wallet
    // bearer credential (and `barcode_value` is a scannable secret). Log only
    // the column being queried, plus the Supabase error, for debugging context.
    console.error(`[cards/queries] fetchOne(${column}) failed`, error);
    throw error;
  }
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

/**
 * Progress toward the customer's NEXT reward: the remainder of the lifetime
 * stamp/point total over the program goal. The raw `stamps`/`points` columns
 * accumulate forever and are never reset — displayed progress "resets to 0"
 * each time a goal is reached because `total % goal` wraps. Banked rewards are
 * tracked separately in `cards.rewards` (see availableRewardsForCustomer).
 */
export function cardProgress(
  card: Pick<Card, "stamps" | "points">,
  program: Pick<Program, "type" | "goal">,
) {
  const total = program.type === "points" ? card.points : card.stamps;
  const goal = program.goal > 0 ? program.goal : 1;
  return total % goal;
}

export interface ActiveProgramSummary {
  cardId: string;
  token: string;
  programName: string;
  programType: ProgramType;
  goal: number;
  progress: number;
  rewardsAvailable: number;
  status: CardStatus;
}

/**
 * A customer's OTHER cards at this business (excluding `excludeCardId`, e.g.
 * the card the caller is currently looking at). Used to surface a
 * customer's other programs alongside a standalone reward.
 *
 * NOTE: despite the name, this does NOT filter by `card.status` or
 * `program.active` — it returns every other card regardless of state, and
 * `status` is included in the result so callers can decide how to present
 * completed/inactive ones. The current caller renders these under a
 * "your other programs" heading (not "active programs"), so keep that
 * framing in mind before reusing this for anything that implies filtering.
 */
export async function getOtherActiveCardsForCustomer(
  supabase: Client,
  businessId: string,
  customerId: string,
  excludeCardId: string,
): Promise<ActiveProgramSummary[]> {
  const { data, error } = await supabase
    .from("cards")
    .select("*, program:programs(name, type, goal)")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .neq("id", excludeCardId);
  if (error) {
    console.error("[cards/queries] getOtherActiveCardsForCustomer failed", {
      businessId,
      customerId,
      error,
    });
    throw error;
  }

  type RowWithProgram = Card & {
    program: Pick<Program, "name" | "type" | "goal"> | null;
  };

  return ((data ?? []) as unknown as RowWithProgram[])
    .filter((row) => row.program !== null)
    .map((row) => ({
      cardId: row.id,
      token: row.pass_auth_token,
      programName: row.program!.name,
      programType: row.program!.type,
      goal: row.program!.goal,
      progress: cardProgress(row, row.program!),
      rewardsAvailable: row.rewards,
      status: row.status,
    }));
}
