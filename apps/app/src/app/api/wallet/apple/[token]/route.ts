import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardByToken } from "@/lib/cards/queries";
import { buildApplePass } from "@/lib/wallet/apple/pass";
import { businessLocations } from "@/lib/wallet/notify";
import { captureServerEvent } from "@/lib/posthog/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/wallet/apple/[token]">,
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
    console.error("[apple pass] card lookup failed", e);
    return NextResponse.json(
      { error: "apple_wallet_unavailable" },
      { status: 503 },
    );
  }
  if (!card) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const locations = await businessLocations(admin, card.business_id);
    const buffer = await buildApplePass(card, locations, card.rewards);

    if (!card.apple_pass_generated_at) {
      await admin
        .from("cards")
        .update({ apple_pass_generated_at: new Date().toISOString() })
        .eq("id", card.id);

      captureServerEvent({
        distinctId: card.customer_id,
        event: "wallet_pass_generated",
        properties: { platform: "apple", program_id: card.program_id },
        groups: { business: card.business_id },
      });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${card.business.slug}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[apple pass] build failed", e);
    return NextResponse.json(
      { error: "apple_wallet_unavailable" },
      { status: 503 },
    );
  }
}
