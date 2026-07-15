import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardByToken } from "@/lib/cards/queries";
import { buildApplePass } from "@/lib/wallet/apple/pass";
import { businessLocations } from "@/lib/wallet/notify";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/wallet/apple/[token]">,
) {
  const { token } = await ctx.params;
  const admin = createAdminClient();
  const card = await getCardByToken(admin, token);
  if (!card) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const locations = await businessLocations(admin, card.business_id);
    const buffer = await buildApplePass(card, locations);
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
