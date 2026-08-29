import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBirthdayRewardDefinition,
  grantStandaloneReward,
} from "@/lib/rewards/queries";
import { notifyCardUpdatedForBirthday } from "@/lib/wallet/notify";
import type { Customer } from "@/types/database";
import type { CardWithRelations } from "@/lib/cards/queries";

export const runtime = "nodejs";

/** Per-business customer batch size for the Promise.allSettled fan-out. */
const CHUNK_SIZE = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Daily cron: grants the birthday reward (if a business has one configured
 * and active) to every customer currently in their birthday month, in their
 * business's timezone, and nudges both wallets to reflect it.
 *
 * The reward is redeemable for the customer's ENTIRE birthday month, not
 * just the exact day. `grantStandaloneReward`'s per-year unique constraint
 * means only the first day of the month the cron sees a match actually
 * grants anything — the grant then stays `available` (redeemable) for the
 * rest of that month, and subsequent days are correctly reported as
 * `skippedAlreadyNotified` rather than re-granting.
 *
 * HARD REQUIREMENT (org data-handling policy): never log or return any
 * customer name/email/id/phone/birthday/token here — counts only. business_id
 * and card/grant ids are fine (not personal data); full customer or card row
 * contents are not.
 */
export async function GET(req: NextRequest) {
  const secret = requireEnv("CRON_SECRET", "birthday reward cron");
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: customers, error } = await admin.rpc(
    "customers_with_birthday_this_month",
  );
  if (error) {
    console.error(
      "[cron/birthday-rewards] customers_with_birthday_this_month failed",
      {
        code: error.code,
        message: error.message,
      },
    );
    return NextResponse.json({ error: "rpc_failed" }, { status: 500 });
  }

  const matchedCustomers = customers?.length ?? 0;

  const byBusiness = new Map<string, Customer[]>();
  for (const customer of customers ?? []) {
    const group = byBusiness.get(customer.business_id);
    if (group) group.push(customer);
    else byBusiness.set(customer.business_id, [customer]);
  }

  let notifiedCustomers = 0;
  let skippedAlreadyNotified = 0;
  let skippedNoActiveReward = 0;
  let errors = 0;

  for (const [businessId, group] of byBusiness) {
    let definition: { id: string; rewardDescription: string } | null;
    try {
      definition = await getBirthdayRewardDefinition(admin, businessId);
    } catch (e) {
      console.error("[cron/birthday-rewards] reward definition lookup failed", {
        businessId,
        error: e instanceof Error ? e.message : String(e),
      });
      errors += 1;
      continue;
    }
    if (!definition) {
      skippedNoActiveReward += group.length;
      continue;
    }

    const { data: businessRow, error: businessError } = await admin
      .from("businesses")
      .select("timezone")
      .eq("id", businessId)
      .single();
    if (businessError || !businessRow) {
      console.error("[cron/birthday-rewards] business timezone lookup failed", {
        businessId,
        code: businessError?.code,
      });
      errors += group.length;
      continue;
    }
    const timezone = businessRow.timezone;
    const year = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
    }).format(new Date());

    for (const batch of chunk(group, CHUNK_SIZE)) {
      const results = await Promise.allSettled(
        batch.map(async (customer) => {
          const granted = await grantStandaloneReward(admin, {
            businessId,
            customerId: customer.id,
            rewardDefinitionId: definition.id,
            periodKey: year,
          });
          if (!granted) return { granted: false as const };

          const { data: cards, error: cardsError } = await admin
            .from("cards")
            .select(
              "*, program:programs(*), business:businesses(*), customer:customers(*)",
            )
            .eq("business_id", businessId)
            .eq("customer_id", customer.id);
          if (cardsError) {
            // Never log the customer id here — business_id/error only.
            console.error("[cron/birthday-rewards] cards lookup failed", {
              businessId,
              code: cardsError.code,
            });
            return { granted: true as const, cardErrors: 1 };
          }

          let cardErrors = 0;
          for (const card of (cards ?? []) as unknown as CardWithRelations[]) {
            try {
              await notifyCardUpdatedForBirthday(admin, card);
            } catch (e) {
              // Log the card id (not customer-identifying) and the
              // error message/code only — never the card/customer row.
              console.error("[cron/birthday-rewards] wallet notify failed", {
                businessId,
                cardId: card.id,
                error: e instanceof Error ? e.message : String(e),
              });
              cardErrors += 1;
            }
          }
          return { granted: true as const, cardErrors };
        }),
      );

      for (const result of results) {
        if (result.status === "rejected") {
          console.error("[cron/birthday-rewards] customer grant failed", {
            businessId,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          });
          errors += 1;
          continue;
        }
        if (!result.value.granted) {
          skippedAlreadyNotified += 1;
        } else {
          notifiedCustomers += 1;
          errors += result.value.cardErrors ?? 0;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checkedBusinesses: byBusiness.size,
    matchedCustomers,
    notifiedCustomers,
    skippedAlreadyNotified,
    skippedNoActiveReward,
    errors,
  });
}
