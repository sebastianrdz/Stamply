import { describe, expect, it } from "vitest";
import { buildStampSvg, FALLBACK_BG } from "./stamp-image";
import { computeStampGrid } from "./stamp-layout";

// Pure unit tests for the SVG string builder only — no network, no native
// rasterizer. `renderStampStrip` (which fetches images and calls Resvg) is
// covered indirectly via the Apple/Google wallet test suites, which mock it.

// buildStampSvg takes width/height as plain params — it doesn't read the
// module's ASPECT_RATIO constant itself, so any W/H pair exercises it; this
// mirrors the renderer's current ~2:1 strip ratio for realism.
const W = 750;
const H = Math.round(W / (375 / 185));

describe("buildStampSvg", () => {
  it("produces a well-formed SVG document sized to width/height", () => {
    const svg = buildStampSvg({
      width: W,
      height: H,
      brandHex: "#7c5cfc",
      bgBuf: null,
      iconBuf: null,
      grid: computeStampGrid(3, 8),
    });

    expect(svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\"")).toBe(true);
    expect(svg).toContain(`width="${W}"`);
    expect(svg).toContain(`height="${H}"`);
    expect(svg).toContain(`viewBox="0 0 ${W} ${H}"`);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("fills the background with the brand color when no bg buffer is given", () => {
    const svg = buildStampSvg({
      width: W,
      height: H,
      brandHex: "#123abc",
      bgBuf: null,
      iconBuf: null,
      grid: computeStampGrid(1, 4),
    });

    expect(svg).toContain('fill="#123abc"');
    expect(svg).not.toContain("<image");
  });

  it("draws the background as an <image> data URI when a bg buffer is given", () => {
    const bgBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]); // PNG magic bytes
    const svg = buildStampSvg({
      width: W,
      height: H,
      brandHex: "#7c5cfc",
      bgBuf,
      iconBuf: null,
      grid: computeStampGrid(1, 4),
    });

    expect(svg).toContain(`<image href="data:image/png;base64,${bgBuf.toString("base64")}"`);
    // No brand-color background rect should be drawn when a bg image exists.
    expect(svg).not.toContain('fill="#7c5cfc"');
  });

  it("falls back to FALLBACK_BG and does not throw for a malformed/malicious brandHex", () => {
    const malicious = 'red" /><script>alert(1)</script><rect fill="';

    expect(() =>
      buildStampSvg({
        width: W,
        height: H,
        brandHex: malicious,
        bgBuf: null,
        iconBuf: null,
        grid: computeStampGrid(1, 4),
      }),
    ).not.toThrow();

    const svg = buildStampSvg({
      width: W,
      height: H,
      brandHex: malicious,
      bgBuf: null,
      iconBuf: null,
      grid: computeStampGrid(1, 4),
    });

    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain(malicious);
    expect(svg).toContain(`fill="${FALLBACK_BG}"`);
  });

  it("accepts a valid brandHex unchanged (case-insensitive)", () => {
    const svg = buildStampSvg({
      width: W,
      height: H,
      brandHex: "#ABCDEF",
      bgBuf: null,
      iconBuf: null,
      grid: computeStampGrid(1, 4),
    });
    expect(svg).toContain('fill="#ABCDEF"');
  });

  it("draws shape fallbacks (filled disc / faint ring) when no icon buffer is given", () => {
    const grid = computeStampGrid(2, 4); // 2 filled, 2 unfilled, single row
    const svg = buildStampSvg({
      width: W,
      height: H,
      brandHex: "#7c5cfc",
      bgBuf: null,
      iconBuf: null,
      grid,
    });

    expect(svg).not.toContain("<image");
    // 2 filled solid discs + 2 unfilled rings = 4 <circle> elements.
    expect(svg.match(/<circle/g)?.length).toBe(4);
    expect(svg).toContain('fill="#ffffff" opacity="0.95"'); // filled disc
    expect(svg).toContain('stroke="#ffffff" stroke-width="2" opacity="0.35"'); // unfilled ring
  });

  it("draws <image> icons (with a backing circle only when filled) when an icon buffer is given", () => {
    const iconBuf = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const grid = computeStampGrid(1, 2); // 1 filled, 1 unfilled, single row
    const svg = buildStampSvg({
      width: W,
      height: H,
      brandHex: "#7c5cfc",
      bgBuf: null,
      iconBuf,
      grid,
    });

    const iconDataUri = `data:image/svg+xml;base64,${iconBuf.toString("base64")}`;
    const imageMatches = svg.match(/<image href="data:image\/svg\+xml/g);
    expect(imageMatches?.length).toBe(2); // one per slot
    expect(svg).toContain(iconDataUri);
  });

  it("renders the full slot count across up to 2 rows for larger grids", () => {
    const grid = computeStampGrid(3, 8); // 4+4 rows
    const svg = buildStampSvg({
      width: W,
      height: H,
      brandHex: "#7c5cfc",
      bgBuf: null,
      iconBuf: null,
      grid,
    });
    expect(svg.match(/<circle/g)?.length).toBe(8);
  });
});
