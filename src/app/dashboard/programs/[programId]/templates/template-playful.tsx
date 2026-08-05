"use client";

import * as React from "react";

/**
 * Playful table-tent: a big rounded "hill" of brand-primary color sits over
 * a brand-secondary base, scattered with a hand-placed (not random — this
 * renders on the server too, so positions must be deterministic) confetti
 * of tinted shapes. Program name gets a friendly -2° tilt.
 *
 * Font stack leans toward rounded faces where the OS has one (San Francisco
 * Rounded, Segoe UI Rounded) and falls back to bold system-ui elsewhere —
 * this SVG is later rasterized through an <img>/<canvas> pipeline with no
 * webfont loading, so anything outside the system font list would silently
 * fall back anyway. The bold weight + generous corner radii around it carry
 * the "rounded" feeling even where the OS has no rounded face installed.
 */
const ROUNDED_FONT =
  '"SF Pro Rounded", "SF Compact Rounded", "Segoe UI Rounded", ui-rounded, system-ui, sans-serif';

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

/** A brand color, darkened first if it's too pale to read on a white chip. */
function readableOnWhite(hex: string): string {
  return luminance(hex) > 0.6 ? tint(hex, -0.5) : hex;
}

/** Scales a single-line SVG <text> down for long strings — there's no
 *  text-layout dependency available, so this is a rough length heuristic
 *  rather than true measurement. Deterministic (no DOM access), so it's
 *  identical between server and client render. */
function fitFontSize(
  text: string,
  base: number,
  min: number,
  charsAtBase: number,
): number {
  if (text.length <= charsAtBase) return base;
  return Math.max(min, Math.round(base * (charsAtBase / text.length)));
}

type ConfettiShape = "circle" | "rect" | "triangle";
interface Confetti {
  x: number;
  y: number;
  r: number;
  shape: ConfettiShape;
  base: "primary" | "secondary";
  amount: number;
  opacity: number;
  rotate: number;
}

/** Fixed scatter — kept clear of the center text column and the QR block. */
const CONFETTI: Confetti[] = [
  {
    x: 120,
    y: 250,
    r: 30,
    shape: "circle",
    base: "secondary",
    amount: 0.3,
    opacity: 0.75,
    rotate: 0,
  },
  {
    x: 1080,
    y: 200,
    r: 24,
    shape: "rect",
    base: "secondary",
    amount: 0.5,
    opacity: 0.65,
    rotate: 15,
  },
  {
    x: 150,
    y: 610,
    r: 20,
    shape: "triangle",
    base: "secondary",
    amount: -0.1,
    opacity: 0.6,
    rotate: -10,
  },
  {
    x: 1050,
    y: 640,
    r: 28,
    shape: "circle",
    base: "secondary",
    amount: 0.15,
    opacity: 0.55,
    rotate: 0,
  },
  {
    x: 95,
    y: 430,
    r: 16,
    shape: "rect",
    base: "secondary",
    amount: 0.6,
    opacity: 0.7,
    rotate: 40,
  },
  {
    x: 1120,
    y: 420,
    r: 20,
    shape: "circle",
    base: "secondary",
    amount: 0.4,
    opacity: 0.55,
    rotate: 0,
  },
  {
    x: 220,
    y: 110,
    r: 14,
    shape: "circle",
    base: "secondary",
    amount: 0.55,
    opacity: 0.65,
    rotate: 0,
  },
  {
    x: 980,
    y: 110,
    r: 18,
    shape: "triangle",
    base: "secondary",
    amount: 0.2,
    opacity: 0.6,
    rotate: 20,
  },
  {
    x: 100,
    y: 960,
    r: 22,
    shape: "circle",
    base: "primary",
    amount: 0.35,
    opacity: 0.5,
    rotate: 0,
  },
  {
    x: 1100,
    y: 1000,
    r: 18,
    shape: "rect",
    base: "primary",
    amount: 0.5,
    opacity: 0.45,
    rotate: 12,
  },
  {
    x: 80,
    y: 1350,
    r: 16,
    shape: "triangle",
    base: "primary",
    amount: 0.25,
    opacity: 0.4,
    rotate: -15,
  },
  {
    x: 1120,
    y: 1400,
    r: 24,
    shape: "circle",
    base: "primary",
    amount: 0.15,
    opacity: 0.4,
    rotate: 0,
  },
  {
    x: 70,
    y: 1650,
    r: 15,
    shape: "rect",
    base: "primary",
    amount: 0.6,
    opacity: 0.5,
    rotate: 30,
  },
  {
    x: 1130,
    y: 1620,
    r: 18,
    shape: "circle",
    base: "primary",
    amount: 0.4,
    opacity: 0.4,
    rotate: 0,
  },
];

export const TemplatePlayful = React.forwardRef<SVGSVGElement, TemplateProps>(
  function TemplatePlayful(
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
    const hillText = contrastText(primaryColor);
    const baseText = contrastText(secondaryColor);
    const chipText = readableOnWhite(primaryColor);

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
              fill={secondaryColor}
              opacity={0.55}
            />
          </>
        ) : (
          <rect x={0} y={0} width={1200} height={1800} fill={secondaryColor} />
        )}

        {/* Big rounded "hill" of brand-primary color — the top half of the poster. */}
        <rect x={0} y={0} width={1200} height={760} fill={primaryColor} />
        <ellipse cx={600} cy={760} rx={900} ry={180} fill={primaryColor} />

        {CONFETTI.map((c, i) => {
          const fill = tint(
            c.base === "primary" ? primaryColor : secondaryColor,
            c.amount,
          );
          if (c.shape === "circle") {
            return (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={c.r}
                fill={fill}
                opacity={c.opacity}
              />
            );
          }
          if (c.shape === "rect") {
            return (
              <rect
                key={i}
                x={c.x - c.r}
                y={c.y - c.r}
                width={c.r * 2}
                height={c.r * 2}
                rx={c.r * 0.35}
                fill={fill}
                opacity={c.opacity}
                transform={`rotate(${c.rotate} ${c.x} ${c.y})`}
              />
            );
          }
          return (
            <polygon
              key={i}
              points={`${c.x},${c.y - c.r} ${c.x + c.r},${c.y + c.r} ${c.x - c.r},${c.y + c.r}`}
              fill={fill}
              opacity={c.opacity}
              transform={`rotate(${c.rotate} ${c.x} ${c.y})`}
            />
          );
        })}

        {logoUrl && (
          <>
            <rect
              x={80}
              y={90}
              width={150}
              height={150}
              rx={32}
              fill="#ffffff"
            />
            <image
              href={logoUrl}
              x={100}
              y={110}
              width={110}
              height={110}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={logoAlt}
            />
          </>
        )}

        {showBusinessName && (
          <text
            x={600}
            y={170}
            textAnchor="middle"
            fontFamily={ROUNDED_FONT}
            fontWeight={700}
            fontSize={fitFontSize(businessName, 34, 22, 26)}
            letterSpacing={4}
            fill={hillText}
            opacity={0.88}
          >
            {businessName.toUpperCase()}
          </text>
        )}

        <text
          x={600}
          y={470}
          textAnchor="middle"
          fontFamily={ROUNDED_FONT}
          fontWeight={800}
          fontSize={fitFontSize(programName, 112, 56, 16)}
          fill={hillText}
          transform="rotate(-2 600 430)"
        >
          {programName}
        </text>

        <text
          x={600}
          y={1040}
          textAnchor="middle"
          fontFamily={ROUNDED_FONT}
          fontWeight={600}
          fontSize={fitFontSize(rewardText, 36, 24, 34)}
          fill={baseText}
        >
          {rewardText}
        </text>

        {/* QR frame: plain white, generous quiet zone — never tinted, so every
            template stays scannable regardless of vibe. The colored rect behind
            it is a decorative "stacked sticker" shadow only. */}
        <rect
          x={348}
          y={1148}
          width={532}
          height={532}
          rx={48}
          fill={tint(secondaryColor, -0.15)}
          opacity={0.5}
        />
        <rect
          x={334}
          y={1130}
          width={532}
          height={532}
          rx={40}
          fill="#ffffff"
        />
        <image
          href={qrDataUrl}
          x={374}
          y={1170}
          width={452}
          height={452}
          preserveAspectRatio="xMidYMid meet"
        />

        <rect x={340} y={1706} width={520} height={78} rx={39} fill="#ffffff" />
        <text
          x={600}
          y={1755}
          textAnchor="middle"
          fontFamily={ROUNDED_FONT}
          fontWeight={700}
          fontSize={fitFontSize(scanToJoinText, 32, 22, 22)}
          letterSpacing={1}
          fill={chipText}
        >
          {scanToJoinText.toUpperCase()}
        </text>
      </svg>
    );
  },
);
