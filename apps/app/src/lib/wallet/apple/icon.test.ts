import { beforeEach, describe, expect, it, vi } from "vitest";

// Hermetic: stub the native rasterizer and the asset fetch.
const resvgCtor = vi.fn();
vi.mock("@resvg/resvg-js", () => ({
  Resvg: class {
    svg: string;
    constructor(svg: string) {
      this.svg = svg;
      resvgCtor(svg);
    }
    render() {
      return { asPng: () => Buffer.from(`png:${this.svg.length}`) };
    }
  },
}));

const imageBufferMock = vi.fn<(url: string | null) => Promise<Buffer | null>>();
const placeholderIconMock = vi.fn(() => Buffer.from("placeholder"));
vi.mock("./assets", () => ({
  imageBuffer: (url: string | null) => imageBufferMock(url),
  placeholderIcon: () => placeholderIconMock(),
}));

import { buildIconSvg, renderPassIconSet } from "./icon";

beforeEach(() => {
  resvgCtor.mockClear();
  imageBufferMock.mockReset();
  placeholderIconMock.mockClear();
});

describe("buildIconSvg", () => {
  it("emits a square SVG with a contain-fit <image> when a logo is given", () => {
    const svg = buildIconSvg({
      logoBuf: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // 8-byte PNG signature
      brandHex: "#7c5cfc",
      size: 58,
    });
    expect(svg).toContain('width="58"');
    expect(svg).toContain('height="58"');
    expect(svg).toContain("<image");
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain("data:image/png;base64,");
  });

  it("falls back to a solid brand-color square (no <image>) when no logo", () => {
    const svg = buildIconSvg({ logoBuf: null, brandHex: "#123456", size: 29 });
    expect(svg).not.toContain("<image");
    expect(svg).toContain('fill="#123456"');
  });

  it("sanitizes an invalid brand color in the fallback", () => {
    const svg = buildIconSvg({ logoBuf: null, brandHex: "javascript:x", size: 29 });
    expect(svg).toContain('fill="#7c5cfc"');
    expect(svg).not.toContain("javascript");
  });
});

describe("renderPassIconSet", () => {
  it("returns icon.png/@2x/@3x rendered at 3 sizes from the logo", async () => {
    imageBufferMock.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const set = await renderPassIconSet("https://cdn/logo.png", "#7c5cfc");
    expect(Object.keys(set).sort()).toEqual([
      "icon.png",
      "icon@2x.png",
      "icon@3x.png",
    ]);
    expect(resvgCtor).toHaveBeenCalledTimes(3);
    expect(placeholderIconMock).not.toHaveBeenCalled();
  });

  it("still returns the 3 icons (brand-color fallback) when there is no logo", async () => {
    imageBufferMock.mockResolvedValue(null);
    const set = await renderPassIconSet(null, "#7c5cfc");
    expect(Object.keys(set)).toHaveLength(3);
    // no logo => the SVG has no <image>, so no data URI is embedded
    expect(resvgCtor).toHaveBeenCalledTimes(3);
    for (const svg of resvgCtor.mock.calls.map((c) => c[0] as string)) {
      expect(svg).not.toContain("<image");
    }
  });

  it("never throws — falls back to the placeholder icon on failure", async () => {
    imageBufferMock.mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const set = await renderPassIconSet("https://cdn/logo.png", "#7c5cfc");
    expect(Object.keys(set)).toHaveLength(3);
    expect(placeholderIconMock).toHaveBeenCalled();
    expect(set["icon.png"]).toEqual(Buffer.from("placeholder"));
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
