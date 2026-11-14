import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { localDate, tzOrUtc } from "@/lib/automations/dates";
import { errInfo } from "@/lib/automations/log";
import { sendMonthlySummaryEmail } from "@/lib/email/send";
import { fetchAll } from "@/lib/pagination";
import { getRoiForRange } from "@/lib/roi";
import { appUrl } from "@/lib/urls";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

export interface MonthlyCounts {
  sent: number;
  skipped: number;
  errors: number;
}

/** A failed send retries on later daily runs, but only this far into the month. */
const SEND_WINDOW_DAYS = 7;

/** Previous local calendar month of `tz`, plus today's day-of-month there. */
export function previousMonth(tz: string, now: Date) {
  const [y, m, d] = localDate(tz, now).split("-").map(Number);
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return {
    key: iso(Date.UTC(y, m - 2, 1)).slice(0, 7),
    from: iso(Date.UTC(y, m - 2, 1)),
    to: iso(Date.UTC(y, m - 1, 0)),
    localDay: d,
  };
}

/**
 * Monthly owner summary, called from the daily cron. Counts only in logs.
 * Idempotent per (business, month): the monthly_summaries claim is taken
 * before sending, kept when there's nothing to say (no visits / no owner
 * email) and released when the send fails so a later day retries.
 * The email goes to the business owner about their own account (not
 * customer marketing), so marketing_consent doesn't apply.
 */
export async function runMonthlySummaries(
  admin: Admin,
  now = new Date(),
): Promise<MonthlyCounts> {
  const counts: MonthlyCounts = { sent: 0, skipped: 0, errors: 0 };
  const businesses = await fetchAll((f, t) =>
    admin
      .from("businesses")
      .select("id, name, timezone, locale, owner_user_id, average_ticket_cents")
      .neq("plan", "none")
      .in("subscription_status", ["trialing", "active", "past_due"])
      .order("id")
      .range(f, t),
  );

  for (const b of businesses) {
    const tz = tzOrUtc(b.timezone);
    const month = previousMonth(tz, now);
    if (month.localDay > SEND_WINDOW_DAYS) continue;

    const { error: claimError } = await admin
      .from("monthly_summaries")
      .insert({ business_id: b.id, period_key: month.key });
    if (claimError) {
      if (claimError.code === "23505") counts.skipped += 1;
      else {
        console.error("[cron/monthly] claim failed", { businessId: b.id, ...errInfo(claimError) });
        counts.errors += 1;
      }
      continue;
    }

    const release = () =>
      admin
        .from("monthly_summaries")
        .delete()
        .eq("business_id", b.id)
        .eq("period_key", month.key);
    try {
      const roi = await getRoiForRange(admin, b, month);
      const { data: owner } = await admin.auth.admin.getUserById(b.owner_user_id);
      const to = owner?.user?.email;
      if (!roi.activeCustomers || !to) {
        counts.skipped += 1;
        continue;
      }
      const locale = b.locale === "en" ? "en" : "es";
      const result = await sendMonthlySummaryEmail({
        to,
        businessName: b.name,
        month: new Intl.DateTimeFormat(locale, {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${month.key}-01T00:00:00Z`)),
        returningCustomers: roi.returningCustomers,
        repeatRatePercent: Math.round(roi.repeatRate * 100),
        revenue:
          roi.estimatedRevenueCents === null
            ? null
            : new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "MXN",
                maximumFractionDigits: 0,
              }).format(roi.estimatedRevenueCents / 100),
        url: `${appUrl()}/dashboard`,
        locale,
      });
      if (!result.ok) {
        await release();
        counts.errors += 1;
      } else counts.sent += 1;
    } catch (e) {
      await release();
      console.error("[cron/monthly] summary failed", { businessId: b.id, ...errInfo(e) });
      counts.errors += 1;
    }
  }
  return counts;
}
