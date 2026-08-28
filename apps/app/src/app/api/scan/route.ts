import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardByBarcode, cardProgress } from "@/lib/cards/queries";
import { notifyCardUpdated } from "@/lib/wallet/notify";
import { captureServerEvent } from "@/lib/posthog/server";

export const runtime = "nodejs";

/** Minimum seconds between stamps on the same card, to prevent double-scans. */
const STAMP_COOLDOWN_SECONDS = 10;

const schema = z.object({
  barcode: z.string().min(1),
  action: z.enum(["stamp", "redeem"]),
  delta: z.coerce.number().int().min(1).max(50).default(1),
  location_id: z.string().uuid().nullish(),
});

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
  const { barcode, action, delta, location_id } = parsed.data;

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

  // A disabled program rejects both stamp and redeem — checked before the
  // cooldown/RPC so a paused program never mutates card state.
  if (!card.program.active) {
    return NextResponse.json({ error: "program_disabled" }, { status: 409 });
  }

  if (action === "stamp") {
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
  } else if (card.status !== "completed") {
    return NextResponse.json({ error: "not_redeemable" }, { status: 409 });
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
  const rpc =
    action === "stamp"
      ? admin.rpc("apply_stamp", {
          p_card_id: card.id,
          p_employee_id: user.id,
          p_delta: delta,
          p_location_id: location_id ?? null,
        })
      : admin.rpc("redeem_card", {
          p_card_id: card.id,
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
    return NextResponse.json(
      { error: "rpc_failed", detail: rpcError.message, code: rpcError.code },
      { status: 400 },
    );
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
    if (action === "stamp") {
      captureServerEvent({
        distinctId: user.id,
        event: "stamp_added",
        properties: {
          program_id: card.program_id,
          program_type: card.program.type,
          progress: cardProgress(mutated, card.program),
          goal: card.program.goal,
          location_id: location_id ?? null,
        },
        groups: { business: card.business_id },
      });
    } else {
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
    });
  }

  return NextResponse.json({ ok: true, action });
}
