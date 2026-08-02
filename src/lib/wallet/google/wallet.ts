import "server-only";

import { GoogleAuth } from "google-auth-library";
import jwt from "jsonwebtoken";
import { requireEnv } from "@/lib/env";
import { appUrlBase } from "@/lib/wallet/shared";
import type { CardWithRelations } from "@/lib/cards/queries";
import { cardProgress } from "@/lib/cards/queries";
import type { PassLocation } from "@/lib/wallet/apple/pass";

const BASE = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

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

/** Create the LoyaltyClass for a program if it does not already exist. */
export async function ensureLoyaltyClass(
  card: CardWithRelations,
): Promise<void> {
  const client = await auth().getClient();
  const id = classId(card.program.id);
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

  try {
    await client.request({ url: `${BASE}/loyaltyClass/${id}`, method: "GET" });
  } catch {
    await client.request({
      url: `${BASE}/loyaltyClass`,
      method: "POST",
      data: loyaltyClass,
    });
  }
}

function objectPayload(card: CardWithRelations, locations: PassLocation[]) {
  const progress = cardProgress(card, card.program);
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
    await client.request({
      url: `${BASE}/loyaltyObject`,
      method: "POST",
      data: objectPayload(card, locations),
    });
  }
}

/** Patch the LoyaltyObject to reflect updated progress; Google pushes the update. */
export async function patchLoyaltyObject(
  card: CardWithRelations,
): Promise<void> {
  const client = await auth().getClient();
  const id = objectId(card.id);
  const progress = cardProgress(card, card.program);
  await client.request({
    url: `${BASE}/loyaltyObject/${id}`,
    method: "PATCH",
    data: { loyaltyPoints: { balance: { int: progress } } },
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
