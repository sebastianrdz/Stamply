import "server-only";

import { PKPass } from "passkit-generator";
import { appUrlBase } from "@/lib/wallet/shared";
import { hexToRgbString, readableForeground } from "@/lib/colors";
import { appleCertificates, applePassConfig } from "./certificates";
import { logoBuffer, placeholderIcon } from "./assets";
import type { CardWithRelations } from "@/lib/cards/queries";
import { cardProgress } from "@/lib/cards/queries";

/**
 * Build a signed .pkpass buffer for a card. The QR encodes the card's opaque
 * barcode value; webServiceURL + authenticationToken let Wallet fetch updates
 * and register for APNs pushes. Business locations drive lock-screen relevance.
 */
export interface PassLocation {
  lat: number;
  lng: number;
  name?: string;
}

export async function buildApplePass(
  card: CardWithRelations,
  locations: PassLocation[] = [],
): Promise<Buffer> {
  const { passTypeIdentifier, teamIdentifier } = applePassConfig();
  const bg = card.business.brand_primary_color;
  const progress = cardProgress(card, card.program);
  const goal = card.program.goal;
  const unit = card.program.type === "points" ? "points" : "stamps";

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    organizationName: card.business.name,
    description: `${card.business.name} loyalty card`,
    serialNumber: card.apple_serial ?? card.id,
    logoText: card.business.name,
    backgroundColor: hexToRgbString(bg),
    foregroundColor: readableForeground(bg),
    labelColor: readableForeground(bg),
    webServiceURL: `${appUrlBase()}/api/apple/v1`,
    authenticationToken: card.pass_auth_token,
    barcodes: [
      {
        message: card.barcode_value,
        format: "PKBarcodeFormatQR" as const,
        messageEncoding: "iso-8859-1",
      },
    ],
    // Lock-screen relevance: pass surfaces when near any of these (max 10).
    locations: locations.slice(0, 10).map((l) => ({
      latitude: l.lat,
      longitude: l.lng,
      relevantText: l.name ? `You're near ${l.name}` : undefined,
    })),
    storeCard: {
      headerFields: [
        {
          key: "progress",
          label: unit.toUpperCase(),
          value: `${progress}/${goal}`,
        },
      ],
      primaryFields: [
        {
          key: "reward",
          label: "REWARD",
          value: card.program.reward_description,
        },
      ],
      secondaryFields: [
        { key: "program", label: "PROGRAM", value: card.program.name },
      ],
      backFields: [
        {
          key: "howto",
          label: "How it works",
          value: `Show this card at ${card.business.name} to collect ${unit}. Reach ${goal} to earn: ${card.program.reward_description}.`,
        },
      ],
    },
  };

  const logo = await logoBuffer(card.business.logo_url);
  const icon = placeholderIcon();

  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      "icon.png": icon,
      "icon@2x.png": icon,
      "logo.png": logo,
      "logo@2x.png": logo,
    },
    appleCertificates(),
  );

  return pass.getAsBuffer();
}
