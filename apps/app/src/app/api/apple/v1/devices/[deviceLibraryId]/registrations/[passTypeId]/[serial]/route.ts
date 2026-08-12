import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { passTokenFromAuth } from "@/lib/wallet/apple/webservice";

export const runtime = "nodejs";

const schema = z.object({ pushToken: z.string().min(1).max(4096) });

type Ctx =
  RouteContext<"/api/apple/v1/devices/[deviceLibraryId]/registrations/[passTypeId]/[serial]">;

/** Register a device to receive push updates for a pass. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { deviceLibraryId, serial } = await ctx.params;
  const token = passTokenFromAuth(req);
  if (!token) return new NextResponse(null, { status: 401 });

  const admin = createAdminClient();
  const { data: card } = await admin
    .from("cards")
    .select("id, business_id, pass_auth_token")
    .eq("apple_serial", serial)
    .maybeSingle();

  if (!card || card.pass_auth_token !== token) {
    return new NextResponse(null, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const { pushToken } = parsed.data;

  const { data: existing } = await admin
    .from("apple_registrations")
    .select("id")
    .eq("device_library_id", deviceLibraryId)
    .eq("pass_serial", serial)
    .maybeSingle();

  if (existing) {
    await admin
      .from("apple_registrations")
      .update({ push_token: pushToken })
      .eq("id", existing.id);
    return new NextResponse(null, { status: 200 });
  }

  await admin.from("apple_registrations").insert({
    business_id: card.business_id,
    card_id: card.id,
    device_library_id: deviceLibraryId,
    pass_serial: serial,
    push_token: pushToken,
  });
  return new NextResponse(null, { status: 201 });
}

/** Unregister a device from a pass. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { deviceLibraryId, serial } = await ctx.params;
  const token = passTokenFromAuth(req);
  if (!token) return new NextResponse(null, { status: 401 });

  const admin = createAdminClient();
  const { data: card } = await admin
    .from("cards")
    .select("pass_auth_token")
    .eq("apple_serial", serial)
    .maybeSingle();
  if (!card || card.pass_auth_token !== token) {
    return new NextResponse(null, { status: 401 });
  }

  await admin
    .from("apple_registrations")
    .delete()
    .eq("device_library_id", deviceLibraryId)
    .eq("pass_serial", serial);
  return new NextResponse(null, { status: 200 });
}
