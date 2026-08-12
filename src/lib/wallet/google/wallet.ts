import "server-only";

import { GoogleAuth } from "google-auth-library";
import jwt from "jsonwebtoken";
import { requireEnv } from "@/lib/env";
import { appUrlBase } from "@/lib/wallet/shared";
import type { CardWithRelations } from "@/lib/cards/queries";
import { cardProgress } from "@/lib/cards/queries";
import type { PassLocation } from "@/lib/wallet/apple/pass";
import { renderStampStrip } from "@/lib/wallet/stamp-image";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const BASE = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const HERO_ASSET_BUCKET = "business-assets";
// Google's loyalty hero image is roughly 1032x336 — close enough to the same
// 375:123 ratio the renderer already uses for Apple's strip that one shape
// serves both call sites.
const HERO_WIDTH = 1032;

function serviceAccount(): { email: string; privateKey: string } {
  const feature = "Google Wallet";
  const email = requireEnv("GOOGLE_WALLET_SA_EMAIL", feature);
  const privateKey = Buffer.from(
    requireEnv("GOOGLE_WALLET_SA_KEY_BASE64", feature),
    "base64",
  ).toString("utf8");
  return { email, privateKey };
}

function issuerId(): string {
  return requireEnv("GOOGLE_WALLET_ISSUER_ID", "Google Wallet");
}

function auth(): GoogleAuth {
  const { email, privateKey } = serviceAccount();
  return new GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: [SCOPE],
  });
}

function sanitize(id: string): string {
  return id.replace(/[^\w.-]/g, "");
}

export function classId(programId: string): string {
  return `${issuerId()}.program_${sanitize(programId.replace(/-/g, ""))}`;
}

export function objectId(cardId: string): string {
  return `${issuerId()}.card_${sanitize(cardId.replace(/-/g, ""))}`;
}

/**
 * Render the stamp-grid hero PNG for a card's current progress and upload it
 * to the business-assets bucket at a state-specific path (per card id +
 * progress), so Google's URL-keyed image cache is busted whenever progress
 * changes. Returns null (never throws) on any failure so callers can fall
 * back to the raw background image instead of leaving the pass broken.
 */
async function renderAndUploadStampHero(
  admin: AdminClient,
  card: CardWithRelations,
  progress: number,
): Promise<string | null> {
  try {
    const png = await renderStampStrip({
      progress,
      goal: card.program.goal,
      brandHex: card.business.brand_primary_color,
      stampIconUrl: card.business.stamp_icon_url ?? null,
      backgroundImageUrl: card.business.background_image_url,
      width: HERO_WIDTH,
    });
    const path = `${card.business_id}/wallet/hero-${card.id}-${progress}.png`;
    const { error } = await admin.storage
      .from(HERO_ASSET_BUCKET)
      .upload(path, png, { contentType: "image/png", upsert: true });
    if (error) throw new Error(error.message);
    return admin.storage.from(HERO_ASSET_BUCKET).getPublicUrl(path).data
      .publicUrl;
  } catch (e) {
    console.error("[google wallet] stamp hero render/upload failed", e);
    return null;
  }
}

/**
 * Hero image URI for the current card state: a rendered stamp grid for
 * stamp-type programs (falling back to the raw background on render/upload
 * failure), or the raw business background unchanged for points programs.
 */
async function heroImageUri(
  admin: AdminClient,
  card: CardWithRelations,
  progress: number,
): Promise<string | undefined> {
  if (card.program.type === "stamp") {
    const rendered = await renderAndUploadStampHero(admin, card, progress);
    if (rendered) return rendered;
  }
  return card.business.background_image_url ?? undefined;
}

/** Create the LoyaltyClass for a program if it does not already exist. */
export async function ensureLoyaltyClass(
  card: CardWithRelations,
): Promise<void> {
  const client = await auth().getClient();
  const id = classId(card.program.id);

  // Check existence FIRST: this runs on every "Add to Wallet" / progress
  // update, and building the class body (in particular the stamp render +
  // upload below) is only needed the one time the class doesn't exist yet —
  // doing it unconditionally would pay for a render, two image fetches, and
  // a Storage upload on every call, all discarded when the class already exists.
  try {
    await client.request({ url: `${BASE}/loyaltyClass/${id}`, method: "GET" });
    return;
  } catch {
    // falls through to create below
  }

  // The class-level heroImage is a generic template: it's shared by every
  // card issued under this program, and an object-level heroImage (set per
  // card in ensureLoyaltyObject/patchLoyaltyObject) always overrides it when
  // present. So this must NOT be a live per-card stamp-progress render —
  // that would bake one customer's progress into every other customer's
  // fallback image. Use the raw business background (or nothing) instead.
  const loyaltyClass = {
    id,
    issuerName: card.business.name,
    programName: card.program.name,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: card.business.brand_primary_color,
    programLogo: card.business.logo_url
      ? { sourceUri: { uri: card.business.logo_url } }
      : undefined,
    heroImage: card.business.background_image_url
      ? { sourceUri: { uri: card.business.background_image_url } }
      : undefined,
  };
  await client.request({
    url: `${BASE}/loyaltyClass`,
    method: "POST",
    data: loyaltyClass,
  });
}

async function objectPayload(
  admin: AdminClient,
  card: CardWithRelations,
  locations: PassLocation[],
) {
  const progress = cardProgress(card, card.program);
  // Per-program: this card's own banked rewards, not a cross-program total.
  const rewards = card.rewards;
  const heroUri = await heroImageUri(admin, card, progress);
  return {
    id: objectId(card.id),
    classId: classId(card.program.id),
    state: "ACTIVE",
    accountName: card.customer.full_name ?? "Member",
    barcode: { type: "QR_CODE", value: card.barcode_value },
    loyaltyPoints: {
      label: card.program.type === "points" ? "Points" : "Stamps",
      balance: { int: progress },
    },
    // Mirrors Apple's REWARDS field — how many rewards this customer can
    // redeem right now, for both program types.
    secondaryLoyaltyPoints: { label: "Rewards", balance: { int: rewards } },
    ...(heroUri && { heroImage: { sourceUri: { uri: heroUri } } }),
    locations: locations.map((l) => ({
      latitude: l.lat,
      longitude: l.lng,
    })),
  };
}

/** Create the LoyaltyObject for a card if missing. */
export async function ensureLoyaltyObject(
  card: CardWithRelations,
  locations: PassLocation[] = [],
): Promise<void> {
  await ensureLoyaltyClass(card);
  const client = await auth().getClient();
  const id = objectId(card.id);
  try {
    await client.request({ url: `${BASE}/loyaltyObject/${id}`, method: "GET" });
  } catch {
    // Single admin client, reused for both the hero render/upload and the
    // rewards count query below (heroImageUri/objectPayload), rather than
    // creating one per use.
    const admin = createAdminClient();
    await client.request({
      url: `${BASE}/loyaltyObject`,
      method: "POST",
      data: await objectPayload(admin, card, locations),
    });
  }
}

/** Patch the LoyaltyObject to reflect updated progress; Google pushes the update.
 *  For stamp programs this also re-renders and re-patches the hero image so
 *  the stamp grid reflects the new progress, and both program types get a
 *  refreshed rewards count. */
export async function patchLoyaltyObject(
  card: CardWithRelations,
): Promise<void> {
  const client = await auth().getClient();
  const id = objectId(card.id);
  const progress = cardProgress(card, card.program);
  const admin = createAdminClient();
  // Per-program: this card's own banked rewards, not a cross-program total.
  const rewards = card.rewards;
  // Intentionally awaited (not fire-and-forget): this adds render+upload
  // latency to notifyCardUpdated's synchronous scan-time call, but on
  // serverless a detached background task can be killed once the response is
  // sent, silently dropping the wallet update. Awaiting trades latency for
  // delivery guarantees; revisit only if that tradeoff becomes a problem.
  const heroUri = await heroImageUri(admin, card, progress);
  await client.request({
    url: `${BASE}/loyaltyObject/${id}`,
    method: "PATCH",
    data: {
      loyaltyPoints: { balance: { int: progress } },
      secondaryLoyaltyPoints: { label: "Rewards", balance: { int: rewards } },
      ...(heroUri && { heroImage: { sourceUri: { uri: heroUri } } }),
    },
  });
}

/** Signed "Save to Google Wallet" URL for a card. */
export async function googleSaveUrl(
  card: CardWithRelations,
  locations: PassLocation[] = [],
): Promise<string> {
  await ensureLoyaltyObject(card, locations);
  const { email, privateKey } = serviceAccount();
  const claims = {
    iss: email,
    aud: "google",
    typ: "savetowallet",
    origins: [appUrlBase()],
    payload: { loyaltyObjects: [{ id: objectId(card.id) }] },
  };
  const token = jwt.sign(claims, privateKey, { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}
