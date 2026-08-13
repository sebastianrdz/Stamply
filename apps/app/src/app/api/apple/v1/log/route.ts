import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Apple Wallet posts diagnostic logs here. Record them for debugging. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { logs?: string[] };
  if (body.logs?.length) {
    console.log("[apple pass log]", ...body.logs);
  }
  return new NextResponse(null, { status: 200 });
}
