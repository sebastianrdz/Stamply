import { describe, expect, it, vi } from "vitest";
import { resolveImageField } from "./upload";
import esDict from "@stamply/i18n/dictionaries/es.json";

const folder = "https://x.supabase.co/storage/v1/object/public/business-assets/biz-1/";
const supabase = {
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: folder } }), upload: vi.fn() }) },
} as never;
const id = "123e4567-e89b-12d3-a456-426614174000";
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("resolveImageField", () => {
  it("accepts a pick from the business folder", async () => {
    const url = `${folder}logo-${id}.png`;
    await expect(
      resolveImageField(supabase, "biz-1", "logo", form({ logo_pick: url }), null, esDict as never),
    ).resolves.toBe(url);
  });
  it("rejects a foreign URL", async () => {
    await expect(
      resolveImageField(
        supabase,
        "biz-1",
        "logo",
        form({ logo_pick: `https://x.supabase.co/storage/v1/object/public/business-assets/biz-2/logo-${id}.png` }),
        null,
        esDict as never,
      ),
    ).rejects.toThrow(esDict.dashboard.programs.errors.assetInvalid);
  });
  it("keeps when untouched, clears on remove", async () => {
    await expect(
      resolveImageField(supabase, "biz-1", "logo", form({}), "u", esDict as never),
    ).resolves.toBeUndefined();
    await expect(
      resolveImageField(supabase, "biz-1", "logo", form({ remove_logo: "1" }), "u", esDict as never),
    ).resolves.toBeNull();
  });
});
