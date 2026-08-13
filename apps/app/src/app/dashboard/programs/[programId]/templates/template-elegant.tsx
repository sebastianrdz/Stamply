"use client";

import * as React from "react";

/**
 * Elegant table-tent: a near-white, brand-tinted page inside a slim rule
 * frame, everything centered with generous whitespace. No color block ever
 * carries the whole background, so the ink color is always derived by
 * darkening `primaryColor` rather than assumed — that keeps the composition
 * legible regardless of how light or dark the business's brand color is.
 *
 * Serif stack is chosen from faces that ship with macOS/Windows/Linux so the
 * later canvas rasterization (no webfont loading in that pipeline) renders
 * the same serif, not a silent sans-serif fallback.
 */
const SERIF_FONT =
  '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const LABEL_FONT = "system-ui, -apple-system, sans-serif";

interface TemplateProps {
  businessName: string;
  programName: string;
  rewardText: string;
  scanToJoinText: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  showBusinessName: boolean;
  qrDataUrl: string;
  previewLabel: string;
  logoAlt: string;
}

function clampChannel(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Blend a #rrggbb color toward white (amount > 0) or black (amount < 0). */
function tint(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  const target = amount >= 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  const mix = (c: number) => clampChannel(c + (target - c) * t);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Scales a single-line SVG <text> down for long strings — a rough length
 *  heuristic (no text-measurement dependency available), deterministic so
 *  server and client render identically. */
function fitFontSize(
  text: string,
  base: number,
  min: number,
  charsAtBase: number,
): number {
  if (text.length <= charsAtBase) return base;
  return Math.max(min, Math.round(base * (charsAtBase / text.length)));
}

export const TemplateElegant = React.forwardRef<SVGSVGElement, TemplateProps>(
  function TemplateElegant(
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
    // Always a very light paper tone and always a dark ink, regardless of
    // how light/dark/saturated the business picked its brand-primary color.
    const paper = tint(primaryColor, 0.95);
    const ink = tint(primaryColor, -0.72);

    return (
      <svg
        ref={ref}
        viewBox="0 0 1200 1800"
        role="img"
        aria-label={previewLabel}
        xmlns="http://www.w3.org/2000/svg"
      >
        {backgroundImageUrl ? (
          <>
            <image
              href={backgroundImageUrl}
              x={0}
              y={0}
              width={1200}
              height={1800}
              preserveAspectRatio="xMidYMid slice"
            />
            {/* A light brand tint, then a near-opaque white wash — keeps a hint
                of the photo without breaking the refined, legible page. */}
            <rect
              x={0}
              y={0}
              width={1200}
              height={1800}
              fill={primaryColor}
              opacity={0.12}
            />
            <rect
              x={0}
              y={0}
              width={1200}
              height={1800}
              fill="#ffffff"
              opacity={0.8}
            />
          </>
        ) : (
          <rect x={0} y={0} width={1200} height={1800} fill={paper} />
        )}

        {/* Slim rule frame — the one accent, kept quiet. */}
        <rect
          x={60}
          y={60}
          width={1080}
          height={1680}
          fill="none"
          stroke={secondaryColor}
          strokeWidth={2}
        />

        {logoUrl && (
          <>
            <image
              href={logoUrl}
              x={550}
              y={160}
              width={100}
              height={100}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={logoAlt}
            />
          </>
        )}

        {showBusinessName && (
          <text
            x={600}
            y={360}
            textAnchor="middle"
            fontFamily={LABEL_FONT}
            fontWeight={600}
            fontSize={fitFontSize(businessName, 24, 16, 30)}
            letterSpacing={6}
            fill={secondaryColor}
          >
            {businessName.toUpperCase()}
          </text>
        )}

        <line
          x1={560}
          y1={400}
          x2={640}
          y2={400}
          stroke={secondaryColor}
          strokeWidth={2}
        />

        <text
          x={600}
          y={540}
          textAnchor="middle"
          fontFamily={SERIF_FONT}
          fontWeight={500}
          fontSize={fitFontSize(programName, 84, 44, 20)}
          fill={ink}
        >
          {programName}
        </text>

        <line
          x1={560}
          y1={590}
          x2={640}
          y2={590}
          stroke={secondaryColor}
          strokeWidth={2}
        />

        <text
          x={600}
          y={660}
          textAnchor="middle"
          fontFamily={LABEL_FONT}
          fontWeight={500}
          fontSize={fitFontSize(rewardText, 30, 20, 40)}
          letterSpacing={1}
          fill={ink}
          opacity={0.75}
        >
          {rewardText}
        </text>

        {/* QR frame: plain white, generous quiet zone — never tinted, so every
            template stays scannable regardless of vibe. The hairline ring
            around it is the only decoration. */}
        <rect
          x={354}
          y={1230}
          width={492}
          height={492}
          rx={6}
          fill="none"
          stroke={secondaryColor}
          strokeWidth={2}
        />
        <rect x={368} y={1244} width={464} height={464} rx={2} fill="#ffffff" />
        <image
          href={qrDataUrl}
          x={408}
          y={1284}
          width={384}
          height={384}
          preserveAspectRatio="xMidYMid meet"
        />

        <text
          x={600}
          y={1762}
          textAnchor="middle"
          fontFamily={LABEL_FONT}
          fontWeight={600}
          fontSize={fitFontSize(scanToJoinText, 26, 18, 24)}
          letterSpacing={5}
          fill={ink}
        >
          {scanToJoinText.toUpperCase()}
        </text>
      </svg>
    );
  },
);
