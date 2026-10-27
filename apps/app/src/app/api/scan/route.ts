import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardByBarcode, cardProgress } from "@/lib/cards/queries";
import { cardState, type ScanAction } from "@/lib/cards/state";
import { notifyCardUpdated } from "@/lib/wallet/notify";
import { captureServerEvent } from "@/lib/posthog/server";
import { getAvailableStandaloneRewardsForCustomer } from "@/lib/rewards/queries";
import type { Card, StandaloneRewardGrant } from "@/types/database";

export const runtime = "nodejs";

/** Minimum seconds between stamps on the same card, to prevent double-scans. */
const STAMP_COOLDOWN_SECONDS = 10;

const schema = z.object({
  barcode: z.string().min(1),
  action: z.enum([
    "lookup",
    "stamp",
    "spend",
    "redeem",
    "redeem_tier",
    "use_coupon",
    "check_in",
    "renew",
    "set_tier",
    "redeem_standalone_reward",
  ]),
  delta: z.coerce.number().int().min(1).max(50).default(1),
  // Spend amount in cents; the server derives the points delta from it.
  amount_cents: z.number().int().min(1).max(10_000_000).optional(),
  tier_index: z.number().int().min(0).optional(),
  tier: z.string().min(1).max(60).optional(),
  location_id: z.string().uuid().nullish(),
  // Only used by (and required for) action === "redeem_standalone_reward".
  grant_id: z.string().uuid().optional(),
});

/** Postgres exceptions from the card-type RPCs -> HTTP status (error code = exception name). */
const RPC_ERRORS: Record<string, number> = {
  insufficient_points: 409,
  coupon_expired: 409,
  coupon_exhausted: 409,
  membership_inactive: 409,
  tier_not_found: 404,
  card_not_found: 404,
  invalid_days: 400,
};

const err = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    // Instrumentation: the client shows a generic message for this code, so log
    // which field(s) failed to tell a malformed/empty scan apart from an RPC
    // failure (both otherwise look identical to the user).
    console.warn("[scan] invalid request body", {
      issues: parsed.error.issues,
    });
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { barcode, action, location_id, grant_id, amount_cents, tier_index, tier } =
    parsed.data;
  let { delta } = parsed.data;
  if (
    (action === "redeem_standalone_reward" && !grant_id) ||
    (action === "spend" && amount_cents === undefined) ||
    (action === "redeem_tier" && tier_index === undefined)
  ) {
    console.warn("[scan] request missing required field for action", { action });
    return err("invalid_request", 400);
  }

  // RLS scopes this to cards in the employee's business(es).
  let card: Awaited<ReturnType<typeof getCardByBarcode>>;
  try {
    card = await getCardByBarcode(supabase, barcode);
  } catch (e) {
    // A real lookup failure is a backend outage, not a missing card — don't
    // report it as card_not_found.
    console.error("[scan] card lookup failed", e);
    return NextResponse.json({ error: "lookup_failed" }, { status: 503 });
  }
  if (!card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }

  // No plan (never subscribed, or canceled) → nothing can be stamped/redeemed.
  if (card.business.plan === "none") {
    return NextResponse.json({ error: "no_plan" }, { status: 402 });
  }

  const isCardAction = action !== "redeem_standalone_reward";

  // Read-only: no cooldown, no mutation.
  if (action === "lookup") {
    return lookupResponse(supabase, card);
  }

  // A disabled program rejects every card action — checked before the
  // cooldown/RPC so a paused program never mutates card state. Standalone
  // rewards (redeem_standalone_reward) aren't tied to this card's program —
  // they're a business/customer-level grant — so a paused program doesn't
  // block them.
  if (isCardAction && !card.program.active) {
    return err("program_disabled", 409);
  }

  const config = (card.program.config ?? {}) as Record<string, unknown>;
  const pointsTiers = (Array.isArray(config.tiers) ? config.tiers : []) as {
    points: number;
    reward: string;
    name?: string;
  }[];

  if (isCardAction) {
    const state = cardState(card, card.program);
    if (action === "redeem" && card.status !== "completed") {
      return err("not_redeemable", 409);
    }
    // Specific codes for the expired/exhausted cases, generic one otherwise.
    if (action === "use_coupon" && state.expired) return err("coupon_expired", 409);
    if (action === "use_coupon" && state.usesLeft === 0) return err("coupon_exhausted", 409);
    if (action === "check_in" && state.expired) return err("membership_inactive", 409);
    if (!state.actions.includes(action as ScanAction)) {
      return err("action_not_allowed", 409);
    }

    if (action === "spend") {
      const rate = Number(config.points_per_unit);
      delta = Math.floor((amount_cents! / 100) * (rate > 0 ? rate : 1));
      if (delta < 1) return err("amount_too_small", 400);
      if (delta > 1_000_000) return err("invalid_request", 400);
    }

    if (action === "redeem_tier") {
      const t = pointsTiers[tier_index!];
      if (!t) return err("tier_not_found", 404);
      if (state.available < t.points) return err("insufficient_points", 409);
    }

    if (action === "set_tier") {
      if (!tier) return err("invalid_request", 400);
      if (!pointsTiers.some((t) => t.name === tier)) return err("tier_not_found", 404);
    }

    if (action === "renew") {
      const days = Number(config.renew_days);
      if (!(days >= 1)) return err("invalid_config", 409);
    }
  }

  if (action === "stamp" || action === "spend") {
    // Cooldown guard against accidental repeat scans.
    const { data: last } = await supabase
      .from("stamp_events")
      .select("created_at, kind")
      .eq("card_id", card.id)
      .eq("kind", "stamp")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last) {
      const elapsed = (Date.now() - new Date(last.created_at).getTime()) / 1000;
      if (elapsed < STAMP_COOLDOWN_SECONDS) {
        return NextResponse.json(
          {
            error: "cooldown",
            retryInSeconds: Math.ceil(STAMP_COOLDOWN_SECONDS - elapsed),
          },
          { status: 429 },
        );
      }
    }
  }

  // apply_stamp/redeem_card are SECURITY DEFINER and bypass RLS internally,
  // so their Postgres EXECUTE grant is restricted to service_role (see
  // supabase/migrations/0008_lock_down_definer_rpcs.sql) — the session
  // client (`authenticated` role) can no longer call them directly. That's
  // safe to do here because authorization already happened above: the RLS
  // policy on `cards` already scoped `getCardByBarcode(supabase, ...)` to
  // cards in a business the signed-in user is a member of (404 otherwise),
  // and `user.id` comes from a verified session — the RPC call below can't
  // be reached with an unauthorized card or a spoofed employee id.
  const admin = createAdminClient();

  // redeem_standalone_reward is SECURITY DEFINER and only checks the grant's
  // own status (see supabase/migrations/0018_birthday_cron_and_redeem_fn.sql)
  // — it does NOT check that the grant belongs to this card's business/
  // customer. Unlike apply_stamp/redeem_card (whose authorization comes
  // entirely from `card` having been resolved through the RLS-scoped
  // `getCardByBarcode(supabase, ...)` above), a grant_id here is an
  // independent id the caller supplies — a valid-but-foreign grant_id would
  // otherwise let this employee redeem another business's reward. So this
  // ownership check is REQUIRED, not defense-in-depth: it's the only thing
  // standing between a foreign grant_id and a cross-business redemption.
  if (action === "redeem_standalone_reward") {
    const { data: grant, error: grantError } = await admin
      .from("standalone_reward_grants")
      .select("*")
      .eq("id", grant_id!)
      .single();
    if (
      grantError ||
      !grant ||
      grant.status !== "available" ||
      grant.business_id !== card.business_id ||
      grant.customer_id !== card.customer_id
    ) {
      return NextResponse.json({ error: "not_redeemable" }, { status: 409 });
    }
  }

  const common = {
    p_card_id: card.id,
    p_employee_id: user.id,
    p_location_id: location_id ?? null,
  };
  const rpc =
    action === "stamp" || action === "spend"
      ? admin.rpc("apply_stamp", { ...common, p_delta: delta })
      : action === "redeem"
        ? admin.rpc("redeem_card", common)
        : action === "redeem_tier"
          ? admin.rpc("redeem_points_tier", { ...common, p_tier_index: tier_index! })
          : action === "use_coupon"
            ? admin.rpc("use_coupon", common)
            : action === "check_in"
              ? admin.rpc("membership_check_in", common)
              : action === "renew"
                ? admin.rpc("renew_membership", {
                    p_card_id: card.id,
                    p_days: Number(config.renew_days),
                  })
                : action === "set_tier"
                  ? // Single-column change: no RPC needed; card was already scoped to the caller's business.
                    admin
                      .from("cards")
                      .update({ tier })
                      .eq("id", card.id)
                      .eq("business_id", card.business_id)
                      .select()
                      .single()
                  : admin.rpc("redeem_standalone_reward", {
                    p_grant_id: grant_id!,
                    p_employee_id: user.id,
                    p_location_id: location_id ?? null,
                  });

  const { data: mutated, error: rpcError } = await rpc;
  if (rpcError) {
    // Instrumentation: surface the real Postgres/RPC failure instead of hiding
    // it behind the client's generic fallback. PostgREST errors carry
    // code/message/details/hint — e.g. "permission denied for function
    // apply_stamp" (code 42501) when the service_role EXECUTE grant from
    // 0008_lock_down_definer_rpcs.sql isn't in effect for this environment.
    // IDs below are internal UUIDs, not customer PII.
    console.error("[scan] RPC failed", {
      action,
      cardId: card.id,
      employeeId: user.id,
      code: rpcError.code,
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
    });
    const known = Object.keys(RPC_ERRORS).find((k) => rpcError.message?.includes(k));
    if (known) return err(known, RPC_ERRORS[known]);
    return NextResponse.json(
      { error: "rpc_failed", detail: rpcError.message, code: rpcError.code },
      { status: 400 },
    );
  }

  // apply_stamp has no amount param (avoids touching the locked-down RPC):
  // tag the event it just wrote. Best-effort — the stamp already succeeded.
  if (action === "spend") {
    try {
      const { data: ev } = await admin
        .from("stamp_events")
        .select("id")
        .eq("card_id", card.id)
        .eq("kind", "stamp")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ev) {
        await admin.from("stamp_events").update({ amount_cents }).eq("id", ev.id);
      }
    } catch (e) {
      console.error("[scan] failed to record amount_cents", e);
    }
  }

  // Capture analytics now, right off the RPC's own returned row: apply_stamp/
  // redeem_card both `returning * into v_card` (see
  // supabase/migrations/0012_accumulating_rewards.sql), so `mutated` already
  // reflects the committed mutation. Firing here — rather than inside the
  // `if (updated)` block below — means the event fires on every successful
  // stamp/redeem regardless of whether the best-effort reload/notify that
  // follows succeeds; `card` (the pre-mutation load) still supplies
  // program_id/program_type/business_id since both loads reference the same
  // card/program.
  if (mutated) {
    if (action === "stamp" || action === "spend") {
      captureServerEvent({
        distinctId: user.id,
        event: "stamp_added",
        properties: {
          program_id: card.program_id,
          program_type: card.program.type,
          progress: cardProgress(mutated as Card, card.program),
          goal: card.program.goal,
          location_id: location_id ?? null,
        },
        groups: { business: card.business_id },
      });
    } else if (
      action === "redeem" ||
      action === "redeem_tier" ||
      action === "use_coupon"
    ) {
      captureServerEvent({
        distinctId: user.id,
        event: "reward_redeemed",
        properties: {
          program_id: card.program_id,
          program_type: card.program.type,
          location_id: location_id ?? null,
        },
        groups: { business: card.business_id },
      });
    } else if (action === "check_in" || action === "renew" || action === "set_tier") {
      captureServerEvent({
        distinctId: user.id,
        event:
          action === "check_in"
            ? "membership_checked_in"
            : action === "renew"
              ? "membership_renewed"
              : "membership_tier_changed",
        properties: { program_id: card.program_id, location_id: location_id ?? null },
        groups: { business: card.business_id },
      });
    } else {
      captureServerEvent({
        distinctId: user.id,
        event: "standalone_reward_redeemed",
        properties: {
          reward_definition_id: (mutated as StandaloneRewardGrant)
            .reward_definition_id,
          location_id: location_id ?? null,
        },
        groups: { business: card.business_id },
      });
    }
  }

  // Reload with relations and push the update to both wallets (best-effort).
  // The stamp/redeem already succeeded above, so a failure here must NOT turn
  // it into an error response (that would invite a double-scan) — fall back to
  // the minimal ok payload.
  let updated: Awaited<ReturnType<typeof getCardByBarcode>> = null;
  try {
    updated = await getCardByBarcode(admin, barcode);
  } catch (e) {
    console.error("[scan] post-mutation reload failed", e);
  }
  if (updated) {
    await notifyCardUpdated(admin, updated);

    // Best-effort: surface this customer's other available standalone
    // rewards (e.g. an unredeemed birthday reward) alongside the scan
    // result, so the scanner UI can show it without a second round trip.
    // Never fails the scan response over this lookup.
    let standaloneRewards;
    try {
      standaloneRewards = await getAvailableStandaloneRewardsForCustomer(
        admin,
        updated.business_id,
        updated.customer_id,
      );
    } catch (e) {
      console.error("[scan] standalone rewards lookup failed", e);
    }

    return NextResponse.json({
      ok: true,
      action,
      customerName: updated.customer.full_name,
      programName: updated.program.name,
      reward: updated.program.reward_description,
      progress: cardProgress(updated, updated.program),
      goal: updated.program.goal,
      status: updated.status,
      type: updated.program.type,
      state: cardState(updated, updated.program),
      ...(standaloneRewards && { standaloneRewards }),
    });
  }

  return NextResponse.json({ ok: true, action });
}

/** `lookup`: card summary + derived state + program info, no side effects. */
async function lookupResponse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  card: NonNullable<Awaited<ReturnType<typeof getCardByBarcode>>>,
) {
  let standaloneRewards;
  try {
    standaloneRewards = await getAvailableStandaloneRewardsForCustomer(
      supabase,
      card.business_id,
      card.customer_id,
    );
  } catch (e) {
    console.error("[scan] standalone rewards lookup failed", e);
  }
  const p = card.program;
  return NextResponse.json({
    ok: true,
    action: "lookup",
    customerName: card.customer.full_name,
    programName: p.name,
    reward: p.reward_description,
    progress: cardProgress(card, p),
    goal: p.goal,
    status: card.status,
    type: p.type,
    state: cardState(card, p),
    program: {
      name: p.name,
      type: p.type,
      reward_description: p.reward_description,
      config: p.config ?? {},
      active: p.active,
    },
    ...(standaloneRewards && { standaloneRewards }),
  });
}
