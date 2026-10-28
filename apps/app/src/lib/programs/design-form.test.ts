import { describe, expect, it } from "vitest";
import { designFromForm } from "./design-form";
import esDict from "@stamply/i18n/dictionaries/es.json";

const folder = "https://x.supabase.co/storage/v1/object/public/business-assets/biz-1/";
const supabase = {
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: folder } }) }) },
} as never;
const id = "123e4567-e89b-12d3-a456-426614174000";
const current = {
  primary_color: "#111111",
  secondary_color: "#222222",
  logo_url: "https://old/logo.png",
  background_image_url: "https://old/bg.png",
  stamp_icon_url: "https://old/s.svg",
  stamp_color: null,
  overlay_opacity: 0.4,
  show_business_name: true,
};
const run = (o: Record<string, string>) => {
  const f = new FormData();
  f.set("primary_color", "#abcdef");
  f.set("secondary_color", "#000000");
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return designFromForm(supabase, "biz-1", f, current, esDict as never);
};

describe("designFromForm", () => {
  it("returns null without design fields", async () => {
    expect(
      await designFromForm(supabase, "biz-1", new FormData(), current, esDict as never),
    ).toBeNull();
  });
  it("keeps untouched images", async () => {
    const r = (await run({})) as { design: typeof current };
    expect(r.design.logo_url).toBe(current.logo_url);
    expect(r.design.primary_color).toBe("#abcdef");
    expect(r.design.show_business_name).toBe(false);
  });
  it("saves a valid stamp color, clears an empty one, rejects a bad one", async () => {
    const ok = (await run({ stamp_color: "#ff0000" })) as { design: typeof current };
    expect(ok.design.stamp_color).toBe("#ff0000");
    const none = (await run({ stamp_color: "" })) as { design: typeof current };
    expect(none.design.stamp_color).toBeNull();
    expect(await run({ stamp_color: "red" })).toHaveProperty("error");
  });
  it("saves the overlay percent as 0..1, keeps it when absent, rejects out of range", async () => {
    const r = (await run({ overlay_opacity: "65" })) as { design: typeof current };
    expect(r.design.overlay_opacity).toBe(0.65);
    const kept = (await run({})) as { design: typeof current };
    expect(kept.design.overlay_opacity).toBe(0.4);
    expect(await run({ overlay_opacity: "150" })).toHaveProperty("error");
  });
  it("clears images on remove_*", async () => {
    const r = (await run({
      remove_logo: "1",
      remove_background: "1",
      remove_stamp: "1",
    })) as { design: typeof current | never };
    expect(r.design.logo_url).toBeNull();
    expect(r.design.background_image_url).toBeNull();
    expect(r.design.stamp_icon_url).toBeNull();
  });
  it("applies a valid pick and errors on a foreign one", async () => {
    const url = `${folder}logo-${id}.png`;
    const ok = (await run({ logo_pick: url })) as { design: typeof current };
    expect(ok.design.logo_url).toBe(url);
    const bad = await run({ logo_pick: `https://evil.com/logo-${id}.png` });
    expect(bad).toEqual({ error: esDict.dashboard.programs.errors.assetInvalid });
  });
});
