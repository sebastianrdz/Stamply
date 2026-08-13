import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx =
  RouteContext<"/api/apple/v1/devices/[deviceLibraryId]/registrations/[passTypeId]">;

/**
 * Return serial numbers of passes updated since the given tag for a device.
 * Tag is an epoch-millis string we previously returned as `lastUpdated`.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { deviceLibraryId } = await ctx.params;
  const since = req.nextUrl.searchParams.get("passesUpdatedSince");
  const sinceMs = since ? Number(since) : 0;

  const admin = createAdminClient();
  const { data: regs } = await admin
    .from("apple_registrations")
    .select("pass_serial")
    .eq("device_library_id", deviceLibraryId);

  const serials = (regs ?? []).map((r) => r.pass_serial);
  if (serials.length === 0) return new NextResponse(null, { status: 204 });

  const { data: cards } = await admin
    .from("cards")
    .select("apple_serial, updated_at")
    .in("apple_serial", serials);

  const updated = (cards ?? []).filter(
    (c) => c.apple_serial && new Date(c.updated_at).getTime() > sinceMs,
  );
  if (updated.length === 0) return new NextResponse(null, { status: 204 });

  const lastUpdated = Math.max(
    ...updated.map((c) => new Date(c.updated_at).getTime()),
  );

  return NextResponse.json({
    serialNumbers: updated.map((c) => c.apple_serial as string),
    lastUpdated: String(lastUpdated),
  });
}
