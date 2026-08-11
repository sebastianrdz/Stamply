import "server-only";

import { PKPass } from "passkit-generator";
import { appUrlBase } from "@/lib/wallet/shared";
import { hexToRgbString, readableForeground } from "@/lib/colors";
import { appleCertificates, applePassConfig } from "./certificates";
import { imageBuffer, logoBuffer, placeholderIcon } from "./assets";
import type { CardWithRelations } from "@/lib/cards/queries";
import { cardProgress } from "@/lib/cards/queries";
import { renderStampStrip } from "@/lib/wallet/stamp-image";

// Apple's storeCard strip display size is 375x123pt; provide @1x/@2x/@3x.
const STRIP_WIDTH_1X = 375;

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
  availableRewards = 0,
): Promise<Buffer> {
  const { passTypeIdentifier, teamIdentifier } = applePassConfig();
  const bg = card.business.brand_primary_color;
  const progress = cardProgress(card, card.program);
  const goal = card.program.goal;
  const isStampProgram = card.program.type === "stamp";
  const unit = card.program.type === "points" ? "points" : "stamps";

  // Apple Wallet silently refuses to add a pass whose webServiceURL is not
  // HTTPS. Locally (http://localhost) we omit it and the auth token: the pass
  // is still valid, it just won't auto-update over APNs until deployed.
  const base = appUrlBase();
  const updatable = base.startsWith("https://");

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    organizationName: card.business.name,
    description: `${card.business.name} loyalty card`,
    serialNumber: card.apple_serial ?? card.id,
    // logoText is the business name shown beside the logo on the pass face;
    // omit it when the business opts to show the logo alone.
    ...(card.business.show_business_name && { logoText: card.business.name }),
    backgroundColor: hexToRgbString(bg),
    foregroundColor: readableForeground(bg),
    labelColor: readableForeground(bg),
    ...(updatable && {
      webServiceURL: `${base}/api/apple/v1`,
      authenticationToken: card.pass_auth_token,
    }),
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
      // Intentional: for stamp programs the strip now renders the stamp
      // grid, and Apple overlays a storeCard's primaryFields directly on top
      // of the strip (centered, bold) — that would collide with the grid, so
      // primaryFields is dropped entirely for stamp programs, moving the
      // reward description to backFields only (still reachable via the i
      // button). Points programs keep the raw-background strip, so the
      // primary field composes over it exactly as before — unchanged.
      ...(!isStampProgram && {
        primaryFields: [
          {
            key: "reward",
            label: "REWARD",
            value: card.program.reward_description,
          },
        ],
      }),
      // Secondary/auxiliary fields render below the strip (not overlapping
      // it), so this is unaffected by the stamp grid. Shows customer identity
      // (name) + how many rewards they can redeem right now — this is about
      // identity, not stamps, so it applies to both stamp and points
      // programs. Program name intentionally leaves the front of the card.
      // Apple lays secondary fields left-to-right; right-aligning REWARDS
      // pins it to the right edge of the row, mirroring NAME on the left.
      secondaryFields: [
        {
          key: "name",
          label: "NAME",
          value: card.customer.full_name ?? "Member",
        },
        {
          key: "rewards",
          label: "REWARDS",
          value: String(availableRewards),
          textAlignment: "PKTextAlignmentRight" as const,
        },
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
  // On a storeCard the strip image spans the top of the pass, sitting behind
  // the header/primary fields — this is the "background behind the stamps".
  // Stamp programs get the rendered stamp-grid strip; points programs keep
  // the raw business background image, unchanged.
  const strip = isStampProgram
    ? await buildStampStripSet(card, progress, goal)
    : await legacyStripSet(card.business.background_image_url);

  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      "icon.png": icon,
      "icon@2x.png": icon,
      "logo.png": logo,
      "logo@2x.png": logo,
      ...strip,
    },
    appleCertificates(),
  );

  return pass.getAsBuffer();
}

/**
 * Renders the stamp-grid strip at @1x/@2x/@3x for stamp-type programs. Never
 * throws: the APNs webservice route that also calls buildApplePass
 * (src/app/api/apple/v1/passes/[passTypeId]/[serial]/route.ts) has no
 * try/catch of its own, so a render failure here (bad/corrupt icon asset,
 * transient rasterizer error, etc.) must not break pass generation — and
 * would otherwise silently break auto-updates for every card on that
 * business. Fall back to the same raw-background strip points programs use.
 */
async function buildStampStripSet(
  card: CardWithRelations,
  progress: number,
  goal: number,
): Promise<Record<string, Buffer>> {
  try {
    const [strip, strip2x, strip3x] = await Promise.all(
      [1, 2, 3].map((scale) =>
        renderStampStrip({
          progress,
          goal,
          brandHex: card.business.brand_primary_color,
          stampIconUrl: card.business.stamp_icon_url ?? null,
          backgroundImageUrl: card.business.background_image_url,
          width: STRIP_WIDTH_1X * scale,
        }),
      ),
    );
    return {
      "strip.png": strip,
      "strip@2x.png": strip2x,
      "strip@3x.png": strip3x,
    };
  } catch (e) {
    console.error("[apple wallet] stamp strip render failed", e);
    return legacyStripSet(card.business.background_image_url);
  }
}

/** Points programs keep the previous behavior: the raw background image, unscaled. */
async function legacyStripSet(
  backgroundImageUrl: string | null,
): Promise<Record<string, Buffer>> {
  const strip = await imageBuffer(backgroundImageUrl);
  return strip ? { "strip.png": strip, "strip@2x.png": strip } : {};
}
