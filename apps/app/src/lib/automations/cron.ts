import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isBirthdayMonth } from "@/lib/customers/birthday";
import { grantStandaloneReward } from "@/lib/rewards/queries";
import { notifyCardUpdatedForBirthday } from "@/lib/wallet/notify";
import type { CardWithRelations } from "@/lib/cards/queries";
import type { Database, RewardDefinition } from "@/types/database";
import { configNumber } from "./config";
import { birthdayTrigger, reminderBucketKey, tzOrUtc, winBackKey } from "./dates";
import { errInfo } from "./log";
import { deliverAutomation } from "./deliver";

type Admin = SupabaseClient<Database>;
type Def = RewardDefinition & { business: { name: string; timezone: string } };
type Cust = {
  id: string;
  full_name: string;
  marketing_consent: boolean;
  birthday: string | null;
};
type Candidate = {
  customerId: string;
  periodKey: string;
  vars: Record<string, string | number>;
};

export interface CronCounts {
  checkedAutomations: number;
  sent: number;
  skippedAlreadySent: number;
  granted: number;
  errors: number;
}

const CHUNK_SIZE = 20;
const PAGE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

const firstName = (full: string | null) => (full ?? "").trim().split(/\s+/)[0];

/** Collect every row of a query PostgREST would cap at max_rows (stable order required). */
export async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = PAGE,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < size) return out;
  }
}

/** All customers of a business (PostgREST caps a page at 1000 rows). */
async function businessCustomers(admin: Admin, businessId: string) {
  return (await fetchAll((f, t) =>
    admin
      .from("customers")
      .select("id, full_name, marketing_consent, birthday")
      .eq("business_id", businessId)
      .order("id")
      .range(f, t),
  )) as Cust[];
}

async function unredeemedCustomerIds(admin: Admin, businessId: string) {
  const [cards, grants] = await Promise.all([
    fetchAll((f, t) =>
      admin
        .from("cards")
        .select("id, customer_id")
        .eq("business_id", businessId)
        .or("rewards.gt.0,status.eq.completed")
        .order("id")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      admin
        .from("standalone_reward_grants")
        .select("id, customer_id")
        .eq("business_id", businessId)
        .eq("status", "available")
        .order("id")
        .range(f, t),
    ),
  ]);
  return new Set([...cards, ...grants].map((r) => r.customer_id));
}

/** Existing behaviour: grant the yearly birthday reward and nudge the wallets. */
async function grantBirthdayReward(
  admin: Admin,
  def: Def,
  customerId: string,
  year: string,
): Promise<{ granted: boolean; errors: number }> {
  const granted = await grantStandaloneReward(admin, {
    businessId: def.business_id,
    customerId,
    rewardDefinitionId: def.id,
    periodKey: year,
  });
  if (!granted) return { granted: false, errors: 0 };
  const { data: cards, error } = await admin
    .from("cards")
    .select("*, program:programs(*), business:businesses(*), customer:customers(*)")
    .eq("business_id", def.business_id)
    .eq("customer_id", customerId);
  if (error) {
    console.error("[cron/automations] cards lookup failed", {
      businessId: def.business_id,
      code: error.code,
    });
    return { granted: true, errors: 1 };
  }
  let errors = 0;
  for (const card of (cards ?? []) as unknown as CardWithRelations[]) {
    try {
      await notifyCardUpdatedForBirthday(admin, card);
    } catch (e) {
      console.error("[cron/automations] wallet notify failed", {
        businessId: def.business_id,
        cardId: card.id,
        ...errInfo(e),
      });
      errors += 1;
    }
  }
  return { granted: true, errors };
}

/** Who should get this cron-driven automation today (pure selection + date math). */
async function candidates(
  admin: Admin,
  def: Def,
  customers: Cust[],
  now: Date,
): Promise<Candidate[]> {
  const tz = def.business.timezone;
  const base = { business: def.business.name };
  const consented = customers.filter((c) => c.marketing_consent);

  if (def.type === "birthday") {
    const daysBefore = configNumber("birthday", def.config);
    return consented.flatMap((c) => {
      const t = birthdayTrigger(c.birthday, tz, now, daysBefore);
      return t
        ? [
            {
              customerId: c.id,
              periodKey: t.periodKey,
              vars: { ...base, name: firstName(c.full_name), days: t.days },
            },
          ]
        : [];
    });
  }

  if (def.type === "unredeemed_reminder") {
    const every = configNumber("unredeemed_reminder", def.config);
    const ids = await unredeemedCustomerIds(admin, def.business_id);
    const periodKey = reminderBucketKey(tz, now, every);
    return consented
      .filter((c) => ids.has(c.id))
      .map((c) => ({
        customerId: c.id,
        periodKey,
        vars: { ...base, name: firstName(c.full_name) },
      }));
  }

  if (def.type === "win_back") {
    const inactive = configNumber("win_back", def.config);
    const data = await fetchAll((f, t) =>
      admin
        .rpc("automation_last_visits", { p_business_id: def.business_id })
        .order("customer_id")
        .range(f, t),
    );
    const byId = new Map(consented.map((c) => [c.id, c]));
    return data.flatMap((r) => {
      const c = byId.get(r.customer_id);
      const key = c && winBackKey(new Date(r.last_visit), inactive, tz, now);
      return c && key
        ? [
            {
              customerId: c.id,
              periodKey: key,
              vars: { ...base, name: firstName(c.full_name), days: inactive },
            },
          ]
        : [];
    });
  }
  return [];
}

/**
 * Daily cron body. Counts only, never customer data, in logs or the result.
 * Idempotent: deliverAutomation's unique (automation, customer, period) claim
 * means a second run the same day sends nothing.
 */
export async function runCronAutomations(
  admin: Admin,
  now = new Date(),
): Promise<CronCounts> {
  const counts: CronCounts = {
    checkedAutomations: 0,
    sent: 0,
    skippedAlreadySent: 0,
    granted: 0,
    errors: 0,
  };
  const { data, error } = await admin
    .from("reward_definitions")
    .select("*, business:businesses(name, timezone)")
    .eq("active", true)
    .in("type", ["birthday", "unredeemed_reminder", "win_back"]);
  if (error) throw error;

  for (const def of (data ?? []) as unknown as Def[]) {
    counts.checkedAutomations += 1;
    try {
      const customers = await businessCustomers(admin, def.business_id);
      const year = new Intl.DateTimeFormat("en-US", {
        timeZone: tzOrUtc(def.business.timezone),
        year: "numeric",
      }).format(now);

      const jobs: (() => Promise<void>)[] = [];
      if (def.type === "birthday" && def.reward_description) {
        for (const c of customers.filter((c) =>
          isBirthdayMonth(c.birthday, def.business.timezone, now),
        )) {
          jobs.push(async () => {
            const r = await grantBirthdayReward(admin, def, c.id, year);
            if (r.granted) counts.granted += 1;
            counts.errors += r.errors;
          });
        }
      }
      for (const cand of await candidates(admin, def, customers, now)) {
        jobs.push(async () => {
          const r = await deliverAutomation(
            admin,
            def,
            cand.customerId,
            cand.periodKey,
            cand.vars,
          );
          if (r === "sent") counts.sent += 1;
          else if (r === "duplicate") counts.skippedAlreadySent += 1;
        });
      }

      for (const batch of chunk(jobs, CHUNK_SIZE)) {
        const results = await Promise.allSettled(batch.map((j) => j()));
        for (const r of results) {
          if (r.status === "rejected") {
            console.error("[cron/automations] job failed", {
              businessId: def.business_id,
              type: def.type,
              ...errInfo(r.reason),
            });
            counts.errors += 1;
          }
        }
      }
    } catch (e) {
      console.error("[cron/automations] automation failed", {
        businessId: def.business_id,
        type: def.type,
        ...errInfo(e),
      });
      counts.errors += 1;
    }
  }
  return counts;
}
