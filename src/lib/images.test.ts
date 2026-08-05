import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAsDataUrl } from "./images";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function bytesOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe("fetchAsDataUrl", () => {
  it("returns null without calling fetch when the url is null", async () => {
    const result = await fetchAsDataUrl(null);
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a base64 data URL using the response's content-type", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => bytesOf("fake-png-bytes"),
    });

    const result = await fetchAsDataUrl("https://cdn.example.com/logo.png");

    expect(fetchMock).toHaveBeenCalledWith("https://cdn.example.com/logo.png");
    expect(result).toBe(
      `data:image/png;base64,${Buffer.from("fake-png-bytes").toString("base64")}`,
    );
  });

  it("strips a charset suffix off the content-type", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/svg+xml; charset=utf-8" }),
      arrayBuffer: async () => bytesOf("<svg/>"),
    });

    const result = await fetchAsDataUrl("https://cdn.example.com/logo.svg");
    expect(result?.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  it("falls back to image/png when content-type is missing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      arrayBuffer: async () => bytesOf("bytes"),
    });

    const result = await fetchAsDataUrl("https://cdn.example.com/logo");
    expect(result?.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("returns null on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const result = await fetchAsDataUrl("https://cdn.example.com/missing.png");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const result = await fetchAsDataUrl("https://cdn.example.com/logo.png");
    expect(result).toBeNull();
  });
});
