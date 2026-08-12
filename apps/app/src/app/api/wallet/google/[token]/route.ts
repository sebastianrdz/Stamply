import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardByToken } from "@/lib/cards/queries";
import { googleSaveUrl, objectId } from "@/lib/wallet/google/wallet";
import { businessLocations } from "@/lib/wallet/notify";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/wallet/google/[token]">,
) {
  const { token } = await ctx.params;
  const admin = createAdminClient();
  const card = await getCardByToken(admin, token);
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
