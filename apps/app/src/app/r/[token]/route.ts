import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCardByToken } from "@/lib/cards/queries";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Review-link redirect: logs a per-customer click, then sends the customer to
 * the business's Google review link. Public (the pass token is the credential,
 * like /c/[token]). Redirects only to the stored, validated URL, never to
 * anything from the request. Logging is best-effort: it must not block the
 * customer.
 */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/r/[token]">,
) {
  const { token } = await ctx.params;
  const admin = createAdminClient();
  let card: Awaited<ReturnType<typeof getCardByToken>>;
  try {
    card = await getCardByToken(admin, token);
  } catch {
    return new NextResponse("Temporarily unavailable", { status: 503 });
  }
  if (!card) return new NextResponse("Not found", { status: 404 });

  const reviewUrl = card.business.google_review_url;
  if (!reviewUrl) {
    return NextResponse.redirect(new URL(`/c/${token}`, req.url));
  }

  // Over the limit: still send them on, just don't record it.
  if (await rateLimit(`review:${card.id}`, 20, 10 * 60 * 1000)) {
    const source =
      new URL(req.url).searchParams.get("s") === "card" ? "card_page" : "message";
    const { error } = await admin.from("review_clicks").insert({
      business_id: card.business_id,
      customer_id: card.customer_id,
      source,
    });
    if (error) {
      console.error("[review] click log failed", {
        businessId: card.business_id,
        code: error.code,
      });
    }
  }
  return NextResponse.redirect(reviewUrl);
}
