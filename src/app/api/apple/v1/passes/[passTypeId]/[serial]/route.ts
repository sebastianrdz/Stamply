import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardByToken } from "@/lib/cards/queries";
import { passTokenFromAuth } from "@/lib/wallet/apple/webservice";
import { buildApplePass } from "@/lib/wallet/apple/pass";
import { businessLocations } from "@/lib/wallet/notify";

export const runtime = "nodejs";

/** Return the latest .pkpass for a serial (called by Wallet after a push). */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/apple/v1/passes/[passTypeId]/[serial]">,
) {
  const { serial } = await ctx.params;
  const token = passTokenFromAuth(req);
  if (!token) return new NextResponse(null, { status: 401 });

  const admin = createAdminClient();
  const card = await getCardByToken(admin, token);
  if (!card || card.apple_serial !== serial) {
    return new NextResponse(null, { status: 401 });
  }

  const locations = await businessLocations(admin, card.business_id);
  const buffer = await buildApplePass(card, locations, card.rewards);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Last-Modified": new Date(card.updated_at).toUTCString(),
      "Cache-Control": "no-store",
    },
  });
}
