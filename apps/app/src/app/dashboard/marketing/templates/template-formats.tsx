"use client";

import * as React from "react";
import {
  FORMAT_SIZES,
  contrastText,
  fitFontSize,
  type TemplateKey,
  type TemplateProps,
} from "./svg-helpers";

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

/**
 * One brand-colored layout shared by the story, square and A5 formats.
 * `inset` keeps content clear of Instagram's UI overlays on stories.
 * Portrait: stacked text over a centered QR. Square: text left, QR right.
 */
function makeTemplate(
  key: Extract<TemplateKey, "story" | "square" | "a5">,
  inset: number,
) {
  const { width: W, height: H } = FORMAT_SIZES[key];
  const landscape = W >= H;
  const qr = landscape ? 380 : Math.round(W * 0.4);
  const pad = landscape ? 80 : 0;

  return React.forwardRef<SVGSVGElement, TemplateProps>(function Template(
    {
      businessName,
      programName,
      rewardText,
      scanToJoinText,
      primaryColor,
      secondaryColor,
      logoUrl,
      backgroundImageUrl,
      showBusinessName,
      qrDataUrl,
      previewLabel,
      logoAlt,
    },
    ref,
  ) {
    const ink = contrastText(primaryColor);
    const anchor = landscape ? "start" : "middle";
    const tx = landscape ? pad : W / 2;
    const textW = landscape ? W - qr - pad * 3 : W - 160;
    // Chars that fit the text column at a given size (rough glyph-width ratios).
    const fits = (size: number, ratio: number) =>
      Math.floor(textW / (size * ratio));
    const nameBase = landscape ? 72 : Math.round(W * 0.085);
    const nameSize = fitFontSize(
      programName,
      nameBase,
      36,
      fits(nameBase, 0.58),
    );
    const rewardBase = landscape ? 38 : Math.round(W * 0.04);
    const rewardSize = fitFontSize(
      rewardText,
      rewardBase,
      22,
      fits(rewardBase, 0.55),
    );
    const bizSize = fitFontSize(businessName, 34, 20, fits(34, 0.85));
    const logoSize = landscape ? 110 : Math.round(W * 0.14);
    const qrX = landscape ? W - pad - qr - 40 : (W - qr) / 2 - 40;
    const qrY = landscape ? (H - qr) / 2 - 40 : H - inset - qr - 80;
    const topY = landscape ? 150 : inset;
    const nameY = topY + logoSize / 2 + 230;

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={previewLabel}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={W} height={H} fill={primaryColor} />
        {backgroundImageUrl && (
          <>
            <image
              href={backgroundImageUrl}
              width={W}
              height={H}
              preserveAspectRatio="xMidYMid slice"
            />
            <rect width={W} height={H} fill={primaryColor} opacity={0.72} />
          </>
        )}
        <rect x={0} y={H - 24} width={W} height={24} fill={secondaryColor} />

        {logoUrl && (
          <image
            href={logoUrl}
            x={landscape ? tx : W / 2 - logoSize / 2}
            y={topY - logoSize / 2}
            width={logoSize}
            height={logoSize}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={logoAlt}
          />
        )}

        {showBusinessName && (
          <text
            x={tx}
            y={topY + logoSize / 2 + 70}
            textAnchor={anchor}
            fontFamily={FONT}
            fontWeight={700}
            fontSize={bizSize}
            letterSpacing={6}
            fill={ink}
            opacity={0.85}
          >
            {businessName.toUpperCase()}
          </text>
        )}

        <text
          x={tx}
          y={nameY}
          textAnchor={anchor}
          fontFamily={FONT}
          fontWeight={800}
          fontSize={nameSize}
          fill={ink}
        >
          {programName}
        </text>

        <text
          x={tx}
          y={nameY + nameSize * 0.9}
          textAnchor={anchor}
          fontFamily={FONT}
          fontWeight={500}
          fontSize={rewardSize}
          fill={ink}
        >
          {rewardText}
        </text>

        {/* White QR panel, never tinted, so it stays scannable. */}
        <rect
          x={qrX}
          y={qrY}
          width={qr + 80}
          height={qr + 80}
          rx={32}
          fill="#ffffff"
        />
        <image
          href={qrDataUrl}
          x={qrX + 40}
          y={qrY + 40}
          width={qr}
          height={qr}
          preserveAspectRatio="xMidYMid meet"
        />
        <text
          x={qrX + (qr + 80) / 2}
          y={qrY + qr + 80 + 70}
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight={700}
          fontSize={fitFontSize(scanToJoinText, 40, 24, 20)}
          letterSpacing={4}
          fill={ink}
        >
          {scanToJoinText.toUpperCase()}
        </text>
      </svg>
    );
  });
}

// Story insets keep content clear of Instagram's top/bottom UI.
export const TemplateStory = makeTemplate("story", 300);
export const TemplateSquare = makeTemplate("square", 0);
export const TemplateA5 = makeTemplate("a5", 260);
