import { describe, expect, it } from "vitest";
import { isBusinessAssetUrl } from "./url";

const folder = "https://x.supabase.co/storage/v1/object/public/business-assets/biz-1/";
const id = "123e4567-e89b-12d3-a456-426614174000";

describe("isBusinessAssetUrl", () => {
  it("accepts a file of the right kind in the business folder", () => {
    expect(isBusinessAssetUrl(`${folder}logo-${id}.png`, folder, "logo")).toBe(true);
    expect(isBusinessAssetUrl(`${folder}stamp-${id}.svg`, folder, "stamp")).toBe(true);
  });
  it("rejects another business's folder", () => {
    const other = folder.replace("biz-1", "biz-2");
    expect(isBusinessAssetUrl(`${other}logo-${id}.png`, folder, "logo")).toBe(false);
  });
  it("rejects external URLs, prefix tricks, traversal and subfolders", () => {
    expect(isBusinessAssetUrl(`https://evil.com/logo-${id}.png`, folder, "logo")).toBe(false);
    expect(isBusinessAssetUrl(`${folder}../biz-2/logo-${id}.png`, folder, "logo")).toBe(false);
    expect(isBusinessAssetUrl(`${folder}wallet/logo-${id}.png`, folder, "logo")).toBe(false);
    expect(isBusinessAssetUrl(`${folder}logo-${id}.png?x=1`, folder, "logo")).toBe(false);
  });
  it("rejects the wrong kind or SVG outside stamp", () => {
    expect(isBusinessAssetUrl(`${folder}logo-${id}.svg`, folder, "logo")).toBe(false);
    expect(isBusinessAssetUrl(`${folder}logo-${id}.png`, folder, "stamp")).toBe(false);
    expect(isBusinessAssetUrl(`${folder}stamp-${id}.png`, folder, "stamp")).toBe(false);
  });
});
