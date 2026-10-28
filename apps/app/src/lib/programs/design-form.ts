import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Dictionary } from "@stamply/i18n/dictionaries";
import { resolveImageField } from "@/lib/assets/upload";
import { isHex, type CardDesign } from "./design";

/**
 * Apply the Design step's form fields on top of `current`. Returns null when
 * the form carries no design fields (leave the stored design alone), else the
 * new full design or a user-facing error.
 */
export async function designFromForm(
  supabase: SupabaseClient<Database>,
  businessId: string,
  formData: FormData,
  current: CardDesign,
  dict: Dictionary,
): Promise<{ design: CardDesign } | { error: string } | null> {
  if (!formData.has("primary_color")) return null;
  const primary = formData.get("primary_color");
  const secondary = formData.get("secondary_color");
  // Optional: empty = keep each icon's own colors.
  const stampColor = formData.get("stamp_color") || null;
  // Slider sends a whole percent; absent (non-stamp card) = keep the current value.
  const overlayRaw = formData.get("overlay_opacity");
  const overlay =
    overlayRaw === null ? current.overlay_opacity : Number(overlayRaw) / 100;
  if (!(overlay >= 0 && overlay <= 1))
    return { error: dict.dashboard.settings.errors.colorFormat };
  if (
    !isHex(primary) ||
    !isHex(secondary) ||
    (stampColor !== null && !isHex(stampColor))
  )
    return { error: dict.dashboard.settings.errors.colorFormat };

  try {
    const pick = async (
      kind: "logo" | "background" | "stamp",
      cur: string | null,
    ) => {
      const r = await resolveImageField(
        supabase,
        businessId,
        kind,
        formData,
        cur,
        dict,
      );
      return r === undefined ? cur : r;
    };
    return {
      design: {
        primary_color: primary,
        secondary_color: secondary,
        logo_url: await pick("logo", current.logo_url),
        background_image_url: await pick(
          "background",
          current.background_image_url,
        ),
        stamp_icon_url: await pick("stamp", current.stamp_icon_url),
        stamp_color: stampColor,
        overlay_opacity: overlay,
        // An unchecked checkbox is absent from the form data.
        show_business_name: formData.get("show_business_name") === "1",
      },
    };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : dict.dashboard.settings.errors.uploadFailed,
    };
  }
}
