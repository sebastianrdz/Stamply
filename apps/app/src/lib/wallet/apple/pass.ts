import "server-only";

import { PKPass } from "passkit-generator";
import { appUrlBase } from "@/lib/wallet/shared";
import { hexToRgbString, readableForeground } from "@/lib/colors";
import { appleCertificates, applePassConfig } from "./certificates";
import { imageBuffer, logoBuffer } from "./assets";
import { renderPassIconSet } from "./icon";
import type { CardWithRelations } from "@/lib/cards/queries";
import { cardState } from "@/lib/cards/state";
import { redeemableCount, slotColors, slotIcons } from "@/lib/cards/milestones";
import { cardText } from "@/lib/cards/text";
import { renderOverlayStrip, renderStampStrip } from "@/lib/wallet/stamp-image";
import { cardUrl } from "@/lib/urls";
import esDict from "@stamply/i18n/dictionaries/es.json";
import { interpolate } from "@stamply/i18n/format";
import { isBirthdayMonth, birthdayMonthWindow } from "@/lib/customers/birthday";
import { getBirthdayRewardDefinition } from "@/lib/rewards/queries";
import { latestOfferForCard } from "@/lib/offers/queries";
import { cardDesign } from "@/lib/programs/design";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

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
  admin?: AdminClient,
): Promise<Buffer> {
  const { passTypeIdentifier, teamIdentifier } = applePassConfig();
  const design = cardDesign(card.program, card.business);
  const bg = design.primary_color;
  const state = cardState(card, card.program);
  const progress = state.progress;
  const goal = card.program.goal;
  const isStampProgram = card.program.type === "stamp";
  // The wallet pass is always shown in Spanish (the product's market), and the
  // APNs refetch path has no request locale, so load es directly.
  const w = esDict.wallet;
  const serialNumber = card.apple_serial ?? card.id;
  const text = cardText(state, card.program, w, {
    locale: "es-MX",
    business: card.business.name,
    rewards: redeemableCount(
      { ...card, rewards: availableRewards },
      card.program,
    ),
    timeZone: card.business.timezone,
  });
  const webUrl = cardUrl(card.pass_auth_token);
  const lastSync = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: card.business.timezone,
  }).format(new Date(card.updated_at));

  // Apple Wallet silently refuses to add a pass whose webServiceURL is not
  // HTTPS. Locally (http://localhost) we omit it and the auth token: the pass
  // is still valid, it just won't auto-update over APNs until deployed.
  const base = appUrlBase();
  const updatable = base.startsWith("https://");

  // Birthday reward lock-screen relevance: best-effort only, and only
  // attempted when an admin (service-role) client is supplied — callers that
  // don't pass one (e.g. tests) simply skip this. Never let a failure here
  // break ordinary pass generation (mirrors buildStampStripSet's try/catch
  // precedent below): a bad/missing reward-definitions row, an invalid
  // business timezone, or a transient DB error should just omit the birthday
  // fields, not fail the whole pass. Relevant for the customer's ENTIRE
  // birthday month, not just the exact day.
  let relevantDates: { startDate: string; endDate: string }[] | undefined;
  let birthdayBackField:
    { key: string; label: string; value: string } | undefined;
  if (admin) {
    try {
      if (
        isBirthdayMonth(card.customer.birthday ?? null, card.business.timezone)
      ) {
        const definition = await getBirthdayRewardDefinition(
          admin,
          card.business_id,
        );
        if (definition) {
          const window = birthdayMonthWindow(card.business.timezone);
          relevantDates = [
            {
              startDate: window.start.toISOString(),
              endDate: window.end.toISOString(),
            },
          ];
          birthdayBackField = {
            key: "birthdayReward",
            label: w.birthdayRewardLabel,
            value: definition.rewardDescription,
          };
        }
      }
    } catch (e) {
      console.error("[apple wallet] birthday reward check failed", e);
    }
  }

  // Business offer: best-effort, same rules as the birthday block above.
  // `changeMessage` is what makes Wallet show a lock-screen notification when
  // the value changes after a push-triggered refetch; an identical re-send
  // changes nothing, so nothing is shown.
  let offerBackField:
    | { key: string; label: string; value: string; changeMessage: string }
    | undefined;
  if (admin) {
    try {
      const offer = await latestOfferForCard(admin, card);
      if (offer) {
        offerBackField = {
          key: "offer",
          label: w.offerLabel,
          value: offer.body,
          changeMessage: "%@",
        };
      }
    } catch (e) {
      console.error("[apple wallet] offer lookup failed", e);
    }
  }

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    organizationName: card.business.name,
    description: interpolate(w.description, { business: card.business.name }),
    serialNumber,
    // logoText is the business name shown beside the logo on the pass face;
    // omit it when the business opts to show the logo alone.
    ...(design.show_business_name && { logoText: card.business.name }),
    backgroundColor: hexToRgbString(bg),
    foregroundColor: readableForeground(bg),
    labelColor: readableForeground(bg),
    ...(updatable && {
      webServiceURL: `${base}/api/apple`,
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
      relevantText: l.name
        ? interpolate(w.nearby, { name: l.name })
        : undefined,
    })),
    // Lock-screen relevance: pass surfaces on the customer's birthday, for the
    // 24h window computed in the business's own timezone.
    ...(relevantDates && { relevantDates }),
    storeCard: {
      headerFields: [
        {
          key: "progress",
          label: text.header.label,
          value: text.header.value,
        },
      ],
      // Intentional: for stamp programs the strip now renders the stamp
      // grid, and Apple overlays a storeCard's primaryFields directly on top
      // of the strip (centered, bold) — that would collide with the grid, so
      // primaryFields is dropped entirely for stamp programs, moving the
      // reward description to backFields only (still reachable via the i
      // button). Other types keep the raw-background strip, so the primary
      // field composes over it.
      ...(text.primary && {
        primaryFields: [{ key: "reward", ...text.primary }],
      }),
      // Secondary/auxiliary fields render below the strip (not overlapping
      // it). Customer name on the left; the type's own fields (rewards, uses
      // left, valid-until...) follow, the last one pinned to the right edge.
      secondaryFields: [
        {
          key: "name",
          label: w.name,
          value: card.customer.full_name ?? w.member,
        },
        ...text.secondary.map((f, i, all) =>
          i === all.length - 1
            ? { ...f, textAlignment: "PKTextAlignmentRight" as const }
            : f,
        ),
      ],
      ...(text.auxiliary.length > 0 && { auxiliaryFields: text.auxiliary }),
      backFields: [
        {
          key: "howto",
          label: w.howToLabel,
          value: text.howTo,
        },
        ...(text.benefits
          ? [{ key: "benefits", label: w.benefitsLabel, value: text.benefits }]
          : []),
        {
          key: "web",
          label: w.webLinkLabel,
          value: webUrl,
          attributedValue: `<a href="${webUrl}">${w.webLinkText}</a>`,
        },
        ...supportFields(card.business, w.supportLabel),
        {
          key: "createdBy",
          label: w.createdByLabel,
          value: card.business.name,
        },
        {
          key: "passId",
          label: w.passIdLabel,
          value: serialNumber,
        },
        {
          key: "lastSync",
          label: w.lastSyncLabel,
          value: lastSync,
        },
        ...(birthdayBackField ? [birthdayBackField] : []),
        ...(offerBackField ? [offerBackField] : []),
      ],
    },
  };

  const logo = await logoBuffer(design.logo_url);
  // The pass icon (shown on the lock screen / notifications) is the business
  // logo on a brand-color square; logo.png (below) is the pass-face logo.
  const iconSet = await renderPassIconSet(
    design.logo_url,
    design.primary_color,
  );
  // On a storeCard the strip image spans the top of the pass, sitting behind
  // the header/primary fields — this is the "background behind the stamps".
  // Stamp programs get the rendered stamp-grid strip; points programs keep
  // the raw business background image, unchanged.
  const strip = isStampProgram
    ? await buildStampStripSet(card, progress, goal)
    : await legacyStripSet(design.background_image_url, design.overlay_opacity);

  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      ...iconSet,
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
  const design = cardDesign(card.program, card.business);
  try {
    const [strip, strip2x, strip3x] = await Promise.all(
      [1, 2, 3].map((scale) =>
        renderStampStrip({
          progress,
          goal,
          brandHex: design.primary_color,
          stampIconUrl: design.stamp_icon_url ?? null,
          slotIconUrls: slotIcons(card.program.config, goal),
          slotColors: slotColors(card.program.config, goal),
          iconColor: design.stamp_color,
          overlayOpacity: design.overlay_opacity,
          backgroundImageUrl: design.background_image_url,
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
    return legacyStripSet(design.background_image_url);
  }
}

/** Points programs keep the previous behavior: the raw background image, unscaled. */
async function legacyStripSet(
  backgroundImageUrl: string | null,
  overlayOpacity = 0,
): Promise<Record<string, Buffer>> {
  if (backgroundImageUrl && overlayOpacity > 0) {
    try {
      const [strip, strip2x, strip3x] = await Promise.all(
        [1, 2, 3].map((scale) =>
          renderOverlayStrip({
            backgroundImageUrl,
            overlayOpacity,
            width: STRIP_WIDTH_1X * scale,
          }),
        ),
      );
      if (strip && strip2x && strip3x)
        return {
          "strip.png": strip,
          "strip@2x.png": strip2x,
          "strip@3x.png": strip3x,
        };
    } catch (e) {
      // Never break pass generation over the overlay: fall back to the raw image.
      console.error("[apple wallet] overlay strip render failed", e);
    }
  }
  const strip = await imageBuffer(backgroundImageUrl);
  return strip ? { "strip.png": strip, "strip@2x.png": strip } : {};
}

/** Support contact as back-field entries; omitted when neither is set. */
function supportFields(
  b: { support_email?: string | null; support_phone?: string | null },
  label: string,
) {
  const value = [b.support_email, b.support_phone].filter(Boolean).join(" · ");
  return value ? [{ key: "support", label, value }] : [];
}
