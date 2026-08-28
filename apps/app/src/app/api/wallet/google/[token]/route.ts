import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardByToken } from "@/lib/cards/queries";
import { googleSaveUrl, objectId } from "@/lib/wallet/google/wallet";
import { businessLocations } from "@/lib/wallet/notify";
import { captureServerEvent } from "@/lib/posthog/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/wallet/google/[token]">,
) {
  const { token } = await ctx.params;
  const admin = createAdminClient();
  let card: Awaited<ReturnType<typeof getCardByToken>>;
  try {
    card = await getCardByToken(admin, token);
  } catch (e) {
    // A real lookup failure (backend down) is "temporarily unavailable", not a
    // missing card — surface it as 503 rather than a misleading 404 or an
    // unhandled 500.
    console.error("[google pass] card lookup failed", e);
    return NextResponse.json(
      { error: "google_wallet_unavailable" },
      { status: 503 },
    );
  }
  if (!card) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const locations = await businessLocations(admin, card.business_id);
    const url = await googleSaveUrl(card, locations);

    // Record the Google object id so future updates know to patch it.
    if (!card.google_object_id) {
      await admin
        .from("cards")
        .update({ google_object_id: objectId(card.id) })
        .eq("id", card.id);

      captureServerEvent({
        distinctId: card.customer_id,
        event: "wallet_pass_generated",
        properties: { platform: "google", program_id: card.program_id },
        groups: { business: card.business_id },
      });
    }

    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[google pass] save url failed", e);
    return NextResponse.json(
      { error: "google_wallet_unavailable" },
      { status: 503 },
    );
  }
}
