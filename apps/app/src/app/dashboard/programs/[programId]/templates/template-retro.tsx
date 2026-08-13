"use client";

import * as React from "react";

/**
 * Retro/bold table-tent: a brand-secondary field behind a brand-primary
 * panel with a hard offset "print misregistration" shadow, a starburst
 * halo behind the QR, and a halftone dot divider. Program name gets a
 * two-color offset-shadow duplicate for that screen-printed poster look.
 *
 * Condensed stack degrades to plain system-ui/sans-serif where the OS has
 * no condensed face — same reasoning as the other two templates: this SVG
 * is later rasterized with no webfont loading, so we only lean on faces
 * that already ship with the major OSes.
 */
const CONDENSED_FONT =
  '"Oswald", "Arial Narrow", "Helvetica Neue Condensed", "Haettenschweiler", system-ui, sans-serif';

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

/** Perceived luminance (0..1) used only to pick a readable ink color. */
function luminance(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or near-black, whichever reads on top of `hex` — some businesses
 *  pick pale brand colors, so text can't assume white always contrasts. */
function contrastText(hex: string): string {
  return luminance(hex) > 0.6 ? "#151515" : "#ffffff";
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

/** Deterministic starburst ring — count jagged triangular spikes between
 *  innerR and outerR around (cx, cy). Pure trig, no randomness, so it's
 *  identical between server and client render. */
function sunburstRays(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  count: number,
): string[] {
  const rays: string[] = [];
  const step = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const a0 = i * step;
    const a1 = a0 + step;
    const mid = a0 + step / 2;
    const x0 = cx + Math.cos(a0) * innerR;
    const y0 = cy + Math.sin(a0) * innerR;
    const x1 = cx + Math.cos(mid) * outerR;
    const y1 = cy + Math.sin(mid) * outerR;
    const x2 = cx + Math.cos(a1) * innerR;
    const y2 = cy + Math.sin(a1) * innerR;
    rays.push(`${x0},${y0} ${x1},${y1} ${x2},${y2}`);
  }
  return rays;
}

/** Halftone dot row — radii follow a sine curve so the row reads as a
 *  gradient of dots, growing then shrinking, like halftone screen printing. */
function halftoneDots(count: number, minR: number, maxR: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const t = Math.sin((i / (count - 1)) * Math.PI);
    return minR + (maxR - minR) * t;
  });
}

export const TemplateRetro = React.forwardRef<SVGSVGElement, TemplateProps>(
  function TemplateRetro(
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
    const clipId = React.useId();
    const panelText = contrastText(primaryColor);
    const ctaText = contrastText(secondaryColor);
    const programFontSize = fitFontSize(programName, 118, 52, 14);
    const rays = sunburstRays(600, 1330, 260, 430, 20);
    const dots = halftoneDots(16, 5, 15);
    const dotsSpan = 700; // px, centered under x=600

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
            <rect
              x={0}
              y={0}
              width={1200}
              height={1800}
              fill={primaryColor}
              opacity={0.55}
            />
          </>
        ) : (
          <rect x={0} y={0} width={1200} height={1800} fill={secondaryColor} />
        )}

        {/* Hard offset "print misregistration" shadow behind the main panel. */}
        <rect
          x={106}
          y={156}
          width={1020}
          height={1620}
          rx={20}
          fill={secondaryColor}
        />
        <rect
          x={90}
          y={140}
          width={1020}
          height={1620}
          rx={20}
          fill={primaryColor}
        />

        {showBusinessName && (
          <text
            x={600}
            y={250}
            textAnchor="middle"
            fontFamily={CONDENSED_FONT}
            fontWeight={700}
            fontSize={fitFontSize(businessName, 30, 20, 26)}
            letterSpacing={6}
            fill={panelText}
            opacity={0.85}
          >
            {businessName.toUpperCase()}
          </text>
        )}

        {logoUrl && (
          <>
            <image
              href={logoUrl}
              x={550}
              y={100}
              width={100}
              height={100}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={logoAlt}
            />
          </>
        )}

        {/* Program name: back copy offset for the screen-printed look, front
            copy always readable against the panel regardless of brand color. */}
        <text
          x={606}
          y={476}
          textAnchor="middle"
          fontFamily={CONDENSED_FONT}
          fontWeight={900}
          fontSize={programFontSize}
          letterSpacing={4}
          fill={secondaryColor}
        >
          {programName.toUpperCase()}
        </text>
        <text
          x={600}
          y={470}
          textAnchor="middle"
          fontFamily={CONDENSED_FONT}
          fontWeight={900}
          fontSize={programFontSize}
          letterSpacing={4}
          fill={panelText}
        >
          {programName.toUpperCase()}
        </text>

        <text
          x={600}
          y={560}
          textAnchor="middle"
          fontFamily={CONDENSED_FONT}
          fontWeight={600}
          fontSize={fitFontSize(rewardText, 32, 20, 34)}
          letterSpacing={1}
          fill={panelText}
          opacity={0.9}
        >
          {rewardText}
        </text>

        {/* Halftone divider. */}
        {dots.map((r, i) => (
          <circle
            key={i}
            cx={600 - dotsSpan / 2 + (dotsSpan / (dots.length - 1)) * i}
            cy={630}
            r={r}
            fill={panelText}
            opacity={0.5}
          />
        ))}

        {/* Starburst accent behind the QR — clipped so it never bleeds outside
            the panel or over the white QR frame's contrast zone. */}
        <clipPath id={clipId}>
          <rect x={90} y={140} width={1020} height={1620} rx={20} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          {rays.map((points, i) => (
            <polygon
              key={i}
              points={points}
              fill={
                i % 2 === 0
                  ? tint(secondaryColor, 0.2)
                  : tint(secondaryColor, -0.1)
              }
              opacity={0.9}
            />
          ))}
        </g>

        {/* QR frame: plain white, generous quiet zone, never tinted — the
            chunky border ring is the only styling applied, so every template
            stays scannable regardless of vibe. */}
        <rect
          x={350}
          y={1080}
          width={500}
          height={500}
          rx={16}
          fill="#ffffff"
          stroke={secondaryColor}
          strokeWidth={14}
        />
        <image
          href={qrDataUrl}
          x={400}
          y={1130}
          width={400}
          height={400}
          preserveAspectRatio="xMidYMid meet"
        />

        <rect
          x={140}
          y={1620}
          width={920}
          height={110}
          rx={12}
          fill={secondaryColor}
        />
        <text
          x={600}
          y={1690}
          textAnchor="middle"
          fontFamily={CONDENSED_FONT}
          fontWeight={800}
          fontSize={fitFontSize(scanToJoinText, 36, 22, 20)}
          letterSpacing={4}
          fill={ctaText}
        >
          {scanToJoinText.toUpperCase()}
        </text>
      </svg>
    );
  },
);
