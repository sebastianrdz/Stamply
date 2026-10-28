import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { computeStampGrid } from "../lib/stamp-layout";

export type WalletField = { label?: string; value: ReactNode };

export interface AppleWalletCardPreviewProps {
  /** Pass background, `#rrggbb`. */
  backgroundColor: string;
  /** Defaults to black/white by luminance (same rule as the real pass). */
  foregroundColor?: string;
  /** Defaults to `foregroundColor`. */
  labelColor?: string;
  logoUrl?: string | null;
  /** Business name beside the logo; omit to show the logo alone. */
  logoText?: string | null;
  /** Top right, e.g. `{ label: "SELLOS", value: "5/7" }`. */
  headerFields?: WalletField[];
  /** Full-bleed image band: a photo, a stamp grid on top of it, or both. */
  strip?: {
    imageUrl?: string | null;
    /** Black overlay on the image behind the stamps, 0..1 (default 0.4). */
    overlayOpacity?: number;
    stamps?: {
      progress: number;
      goal: number;
      iconUrl?: string | null;
      /** Icon per 1-based stamp number (milestones, final reward). Falls back to `iconUrl`. */
      slotIcons?: Record<number, string | null>;
      /** Tints icons (silhouette) and the fallback circles; omit to keep icon colors. */
      iconColor?: string | null;
      /** Per 1-based stamp number; overrides `iconColor` for that slot. */
      slotColors?: Record<number, string | null>;
    };
  } | null;
  /** Big field, overlaid on the strip when there is one. */
  primaryField?: WalletField | null;
  /** Below the strip: first on the left, last right-aligned, rest between. */
  secondaryFields?: WalletField[];
  auxiliaryFields?: WalletField[];
  /** A ReactNode, or `{ src }` for a QR image. Shown in a white box at the bottom.
   *  Omitted: a realistic placeholder QR. `null`: no barcode. */
  barcode?: ReactNode | { src: string; alt?: string } | null;
  className?: string;
}

const HEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

/** Black or white by luminance: same formula as `readableForeground` in apps/app. */
function readable(hex: string): string {
  const m = HEX.exec(hex.trim());
  if (!m) return "#ffffff";
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
    ? "#11131a"
    : "#ffffff";
}

const QR_N = 25; // QR version 2

/** Static QR-looking matrix (finders, timing, alignment, seeded filler): not scannable. */
const QR_PATH = (() => {
  let seed = 7;
  const rnd = () =>
    ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 8) & 1;
  const finder = (x: number, y: number, o: number, p: number) => {
    const dx = Math.min(x - o, 6 - (x - o)),
      dy = Math.min(y - p, 6 - (y - p));
    const d = Math.min(dx, dy);
    return d === 0 || d >= 2;
  };
  let d = "";
  for (let y = 0; y < QR_N; y++)
    for (let x = 0; x < QR_N; x++) {
      const inF = (ox: number, oy: number) =>
        x >= ox - 1 && x <= ox + 7 && y >= oy - 1 && y <= oy + 7;
      let on: boolean;
      if (inF(0, 0) || inF(QR_N - 7, 0) || inF(0, QR_N - 7)) {
        const [ox, oy] =
          x < 9 && y < 9 ? [0, 0] : x > 15 ? [QR_N - 7, 0] : [0, QR_N - 7];
        const lx = x - ox,
          ly = y - oy;
        on = lx >= 0 && lx <= 6 && ly >= 0 && ly <= 6 && finder(x, y, ox, oy);
      } else if (x >= 16 && x <= 20 && y >= 16 && y <= 20) {
        const m = Math.max(Math.abs(x - 18), Math.abs(y - 18));
        on = m !== 1; // alignment pattern
      } else if (y === 6 || x === 6) {
        on = (x + y) % 2 === 0; // timing
      } else on = rnd() === 1;
      if (on) d += `M${x} ${y}h1v1h-1z`;
    }
  return d;
})();

function PlaceholderQr() {
  return (
    <svg
      viewBox={`-1 -1 ${QR_N + 2} ${QR_N + 2}`}
      className="aspect-square w-full"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d={QR_PATH} fill="#000" />
    </svg>
  );
}

function isImage(b: unknown): b is { src: string; alt?: string } {
  return typeof b === "object" && b !== null && "src" in b;
}

/**
 * Apple Wallet storeCard look-alike. Props mirror the pass.json field model, so
 * a preview maps 1:1 to the pass we generate. Everything is sized in `cqw`
 * (percent of the card's own width): the card scales with its parent, which
 * sets the width. Plain `<img>` throughout, so any app can render it.
 */
export function AppleWalletCardPreview({
  backgroundColor,
  foregroundColor,
  labelColor,
  logoUrl,
  logoText,
  headerFields = [],
  strip,
  primaryField,
  secondaryFields = [],
  auxiliaryFields = [],
  barcode,
  className,
}: AppleWalletCardPreviewProps) {
  const fg = foregroundColor ?? readable(backgroundColor);
  const label = labelColor ?? fg;
  const grid = strip?.stamps
    ? computeStampGrid(strip.stamps.progress, strip.stamps.goal)
    : null;
  const iconUrl = strip?.stamps?.iconUrl;

  const field = (
    f: WalletField,
    i: number,
    align: "left" | "right",
    big = false,
  ) => (
    <div
      key={i}
      className={cn("min-w-0", align === "right" ? "text-right" : "text-left")}
    >
      {f.label && (
        <p
          className="truncate text-[2.6cqw] leading-tight font-medium tracking-wide uppercase"
          style={{ color: label }}
        >
          {f.label}
        </p>
      )}
      <div
        className={cn(
          "truncate leading-tight font-light",
          big ? "text-[7cqw]" : "text-[5.5cqw]",
        )}
      >
        {f.value}
      </div>
    </div>
  );

  const fieldRow = (fields: WalletField[]) =>
    fields.length > 0 && (
      <div className="flex items-end justify-between gap-[3cqw] px-[3.5cqw] pt-[2.5cqw]">
        {fields.map((f, i) =>
          field(
            f,
            i,
            i === fields.length - 1 && fields.length > 1 ? "right" : "left",
          ),
        )}
      </div>
    );

  return (
    <div
      className={cn(
        "@container flex aspect-[1186/1668] w-full flex-col overflow-hidden rounded-xl shadow-lg",
        className,
      )}
      style={{ backgroundColor, color: fg }}
    >
      <div className="flex items-start justify-between gap-[3cqw] px-[3.5cqw] pt-[3.5cqw] pb-[2cqw]">
        <div className="flex min-w-0 items-center gap-[2cqw]">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- shared package: no next/image
            <img
              src={logoUrl}
              alt=""
              className="h-[9cqw] max-w-[28cqw] object-contain"
            />
          )}
          {logoText && (
            <span className="truncate text-[4cqw] leading-tight font-medium">
              {logoText}
            </span>
          )}
        </div>
        <div className="flex shrink-0 gap-[3cqw]">
          {headerFields.map((f, i) => field(f, i, "right"))}
        </div>
      </div>

      {strip && (
        <div className="relative aspect-[375/145] w-full shrink-0 overflow-hidden">
          {strip.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- shared package: no next/image
            <img
              src={strip.imageUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          )}
          {/* Same ~40% shade the generated stamp strip uses, so stamps stay legible. */}
          {(strip.overlayOpacity ?? (grid ? 0.4 : 0)) > 0 && (
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: strip.overlayOpacity ?? 0.4 }}
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqw] px-[4cqw]">
            {grid?.rows.map((row, r) => (
              <div key={r} className="flex w-full justify-center gap-[2.5cqw]">
                {row.map((slot, s) => {
                  const icon =
                    strip?.stamps?.slotIcons?.[slot.index] ?? iconUrl;
                  const tint =
                    strip?.stamps?.slotColors?.[slot.index] ??
                    strip?.stamps?.iconColor;
                  if (icon && tint)
                    return (
                      // Mask, not <img>: recolors any SVG and never executes it.
                      <div
                        key={s}
                        className="aspect-square max-w-[16cqw] flex-1"
                        style={{
                          backgroundColor: tint,
                          opacity: slot.filled ? 1 : 0.25,
                          maskImage: `url("${icon}")`,
                          WebkitMaskImage: `url("${icon}")`,
                          maskSize: "contain",
                          WebkitMaskSize: "contain",
                          maskRepeat: "no-repeat",
                          WebkitMaskRepeat: "no-repeat",
                          maskPosition: "center",
                          WebkitMaskPosition: "center",
                        }}
                      />
                    );
                  return icon ? (
                    // Raw <img> (never inline <svg>) so untrusted SVG is never executed.
                    // eslint-disable-next-line @next/next/no-img-element -- shared package: no next/image
                    <img
                      key={s}
                      src={icon}
                      alt=""
                      className="aspect-square max-w-[16cqw] flex-1 object-contain"
                      style={{ opacity: slot.filled ? 1 : 0.25 }}
                    />
                  ) : (
                    <div
                      key={s}
                      className={cn(
                        "aspect-square max-w-[14cqw] flex-1 rounded-full",
                        !tint &&
                          (slot.filled
                            ? "bg-white"
                            : "border-[0.4cqw] border-white/40"),
                        tint && !slot.filled && "border-[0.4cqw]",
                      )}
                      style={
                        tint
                          ? slot.filled
                            ? { backgroundColor: tint }
                            : { borderColor: tint, opacity: 0.4 }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ))}
            {!grid && primaryField && (
              <div className="text-start" style={{ color: fg }}>
                {primaryField.label && (
                  <p className="text-[2.6cqw] font-medium tracking-wide uppercase text-white">
                    {primaryField.label}
                  </p>
                )}
                <div className="text-[8cqw] leading-tight font-light text-white">
                  {primaryField.value}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!strip && primaryField && (
        <div className="px-[3.5cqw] pt-[2cqw]">
          {field(primaryField, 0, "left", true)}
        </div>
      )}
      {fieldRow(secondaryFields)}
      {fieldRow(auxiliaryFields)}

      {barcode !== null && (
        <div className="mt-auto flex justify-center pt-[3cqw] pb-[3.5cqw]">
          <div className="w-[39.5cqw] rounded-[2cqw] bg-white p-[2.5cqw]">
            {barcode === undefined ? (
              <PlaceholderQr />
            ) : isImage(barcode) ? (
              // eslint-disable-next-line @next/next/no-img-element -- shared package: no next/image
              <img
                src={barcode.src}
                alt={barcode.alt ?? ""}
                className="aspect-square w-full"
              />
            ) : (
              barcode
            )}
          </div>
        </div>
      )}
    </div>
  );
}
