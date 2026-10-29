"use server";

import { CURRENCIES, DEFAULT_CURRENCY } from "./currency";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/posthog/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary, type Dictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import {
  assertWithinLimit,
  LimitExceededError,
} from "@/lib/billing/entitlements";
import { cardDesign } from "./design";
import { designFromForm } from "./design-form";
import { milestoneIcons } from "./milestone-icons";
import { notifyProgramDesignChanged } from "@/lib/wallet/notify";

export interface ProgramFormState {
  error?: string;
}

/** Maximum stamps a stamp-type card can require — the stamp grid renders at
 *  most 10 slots, so goals above this aren't allowed for stamp programs. */
const MAX_STAMP_GOAL = 10;

const tierName = z.string().trim().min(1).max(60);
const money = z.number().int().min(0).max(10_000_000);

const pointsConfig = z.object({
  earn: z.enum(["visit", "spend"]).default("visit"),
  points_per_unit: z.number().positive().max(10_000).default(1),
  currency: z.enum(CURRENCIES).default(DEFAULT_CURRENCY),
  tiers: z
    .array(
      z.object({
        points: z.number().int().min(1).max(1_000_000),
        reward: z.string().trim().min(1).max(100),
      }),
    )
    .min(1)
    .max(10)
    .optional(),
});

// icon_url / reward_icon_url are never trusted from the client: milestoneIcons()
// overwrites them from the uploaded/picked form fields.
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const stampConfig = z.object({
  milestones: z
    .array(
      z.object({
        at: z.number().int().min(1).max(MAX_STAMP_GOAL),
        reward: z.string().trim().min(1).max(120),
        icon_url: z.string().nullable().optional(),
        icon_color: hexColor.nullable().optional(),
      }),
    )
    .max(MAX_STAMP_GOAL)
    .optional(),
  reward_icon_url: z.string().nullable().optional(),
  reward_icon_color: hexColor.nullable().optional(),
});

const couponConfig = z
  .object({
    discount_kind: z.enum(["percent", "fixed", "item"]),
    value: z.number().min(0).max(10_000_000),
    max_uses: z.number().int().min(1).nullable().default(1),
    valid_days: z.number().int().min(1).max(3650).nullable().default(null),
    min_spend_cents: money.optional(),
  })
  .refine(
    (c) => c.discount_kind !== "percent" || (c.value > 0 && c.value <= 100),
  );

const membershipConfig = z.object({
  access: z.enum(["free", "staff_activated"]),
  tiers: z
    .array(z.object({ name: tierName, benefits: z.string().trim().max(200) }))
    .max(10)
    .default([]),
  renew_days: z.number().int().min(1).max(3650),
});

/** Shared create/update validation: discriminated on `type`, each type with its
 *  own `config`. Stamp programs are capped at 10 stamps; points keep the generous
 *  1000 ceiling; coupon/membership always store goal = 1. */
function programSchema(dict: Dictionary) {
  const e = dict.dashboard.programs.errors;
  const base = {
    name: z.string().min(2, e.nameRequired).max(80),
    goal: z.coerce.number().int().min(1, e.goalMin).max(1000),
    reward_description: z.string().min(2, e.rewardRequired).max(200),
  };
  return z
    .discriminatedUnion("type", [
      z.object({ ...base, type: z.literal("stamp"), config: stampConfig }),
      z.object({ ...base, type: z.literal("points"), config: pointsConfig }),
      z.object({
        ...base,
        type: z.literal("coupon"),
        config: couponConfig,
      }),
      z.object({
        ...base,
        type: z.literal("membership"),
        config: membershipConfig,
      }),
    ])
    .superRefine((val, ctx) => {
      if (val.type === "stamp" && val.goal > MAX_STAMP_GOAL) {
        ctx.addIssue({
          code: "custom",
          path: ["goal"],
          message: e.stampGoalMax,
        });
      }
      if (val.type === "stamp") {
        const ats = (val.config.milestones ?? []).map((m) => m.at);
        if (
          new Set(ats).size !== ats.length ||
          ats.some((at) => at >= val.goal)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["config"],
            message: e.milestoneInvalid,
          });
        }
      }
    })
    .transform((val) =>
      val.type === "coupon" || val.type === "membership"
        ? { ...val, goal: 1 }
        : val,
    );
}

/** The `config` form field is JSON; unparsable input becomes undefined so the
 *  schema rejects it. Missing/empty = `{}`. */
function parseConfigField(raw: FormDataEntryValue | null): unknown {
  if (raw == null || raw === "") return {};
  try {
    return JSON.parse(String(raw));
  } catch {
    return undefined;
  }
}

function firstError(
  issues: { path: PropertyKey[]; message: string }[],
  dict: Dictionary,
) {
  const i = issues[0];
  return i.path[0] === "config" || i.path[0] === "type"
    ? dict.dashboard.programs.errors.configInvalid
    : i.message;
}

export async function createProgram(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const { user, membership } = await requireRole(["owner", "admin"]);
  const business = membership.business;
  const dict = await getDictionary(await getLocale());

  const parsed = programSchema(dict).safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    goal: formData.get("goal"),
    reward_description: formData.get("reward_description"),
    config: parseConfigField(formData.get("config")),
  });
  if (!parsed.success) return { error: firstError(parsed.error.issues, dict) };

  const supabase = await createClient();

  try {
    await assertWithinLimit(supabase, business, "programs");
  } catch (e) {
    if (e instanceof LimitExceededError) {
      return {
        error: interpolate(dict.dashboard.billing.limitExceeded, {
          limit: e.limit,
          resource: dict.dashboard.billing.resources[e.resource],
        }),
      };
    }
    throw e;
  }

  const designResult = await designFromForm(
    supabase,
    business.id,
    formData,
    cardDesign({}, business),
    dict,
  );
  if (designResult && "error" in designResult)
    return { error: designResult.error };

  let config: Record<string, unknown> = parsed.data.config;
  if (parsed.data.type === "stamp") {
    const icons = await milestoneIcons(
      supabase,
      business.id,
      formData,
      parsed.data.config,
      null,
      dict,
    );
    if ("error" in icons) return { error: icons.error };
    config = icons.config;
  }

  const { error } = await supabase.from("programs").insert({
    business_id: business.id,
    name: parsed.data.name,
    type: parsed.data.type,
    goal: parsed.data.goal,
    reward_description: parsed.data.reward_description,
    config,
    // No design fields submitted = inherit the business look (cardDesign fallback).
    design: designResult?.design ?? {},
  });
  if (error) return { error: error.message };

  captureServerEvent({
    distinctId: user.id,
    event: "program_created",
    properties: { program_type: parsed.data.type, goal: parsed.data.goal },
    groups: { business: business.id },
  });

  revalidatePath("/dashboard/cards");
  redirect("/dashboard/cards?created=1");
}

export async function toggleProgramActive(programId: string, active: boolean) {
  const { user, membership } = await requireRole(["owner", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("programs")
    .update({ active })
    .eq("id", programId)
    .eq("business_id", membership.business.id);

  if (!error && active) {
    captureServerEvent({
      distinctId: user.id,
      event: "program_activated",
      properties: { program_id: programId },
      groups: { business: membership.business.id },
    });
  }

  revalidatePath("/dashboard/cards");
  revalidatePath(`/dashboard/cards/${programId}`);
}

export async function updateProgram(
  programId: string,
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const { user, membership } = await requireRole(["owner", "admin"]);
  const business = membership.business;
  const dict = await getDictionary(await getLocale());

  const supabase = await createClient();

  // Type is locked after creation: existing cards would reread the other
  // counter column. Validate against the stored type, never the submitted one.
  const { data: existing } = await supabase
    .from("programs")
    .select("type, config, design")
    .eq("id", programId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!existing) return { error: dict.dashboard.programs.delete.notFoundError };

  const parsed = programSchema(dict).safeParse({
    name: formData.get("name"),
    type: existing.type,
    goal: formData.get("goal"),
    reward_description: formData.get("reward_description"),
    // Field absent = keep the stored config.
    config: formData.has("config")
      ? parseConfigField(formData.get("config"))
      : (existing.config ?? {}),
  });
  if (!parsed.success) return { error: firstError(parsed.error.issues, dict) };

  const before = cardDesign(existing, business);
  const designResult = await designFromForm(
    supabase,
    business.id,
    formData,
    before,
    dict,
  );
  if (designResult && "error" in designResult)
    return { error: designResult.error };
  const designChanged =
    !!designResult &&
    JSON.stringify(designResult.design) !== JSON.stringify(before);

  // Stamp programs: resolve milestone icons only when the form sent a config
  // (absent = keep the stored one, icons included).
  let config: Record<string, unknown> = parsed.data.config;
  if (parsed.data.type === "stamp" && formData.has("config")) {
    const icons = await milestoneIcons(
      supabase,
      business.id,
      formData,
      parsed.data.config,
      existing.config,
      dict,
    );
    if ("error" in icons) return { error: icons.error };
    config = icons.config;
  }
  const configChanged =
    parsed.data.type === "stamp" &&
    JSON.stringify(config) !== JSON.stringify(existing.config ?? {});

  const { error } = await supabase
    .from("programs")
    .update({
      name: parsed.data.name,
      goal: parsed.data.goal,
      reward_description: parsed.data.reward_description,
      config,
      ...(designResult && { design: designResult.design }),
    })
    .eq("id", programId)
    .eq("business_id", business.id);
  if (error) return { error: error.message };

  // Wallet passes bake in the design; push it to every card of this program.
  // Best-effort: the edit itself already succeeded.
  if (designChanged || configChanged)
    await notifyProgramDesignChanged(supabase, programId).catch((e) =>
      console.error("[programs] design wallet push failed", e),
    );

  captureServerEvent({
    distinctId: user.id,
    event: "program_updated",
    properties: {
      program_id: programId,
      program_type: parsed.data.type,
      goal: parsed.data.goal,
    },
    groups: { business: business.id },
  });

  revalidatePath("/dashboard/cards");
  revalidatePath(`/dashboard/cards/${programId}`);
  redirect(`/dashboard/cards/${programId}?updated=1`);
}

/**
 * Hard-delete a program and everything that cascades off it (cards, then
 * their stamp events/redemptions/wallet registrations — see
 * supabase/migrations/0001_init.sql). Only ever allowed while the program is
 * disabled: the client gates its delete control on `!program.active`, but
 * that's a UI convenience only — this re-checks server-side because a client
 * can't be trusted to enforce it, and rejects (instead of deleting) an active
 * program.
 */
export async function deleteProgram(
  programId: string,
  _prev: ProgramFormState,
  _formData: FormData,
): Promise<ProgramFormState> {
  const { user, membership } = await requireRole(["owner", "admin"]);
  const dict = await getDictionary(await getLocale());
  const supabase = await createClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, active")
    .eq("id", programId)
    .eq("business_id", membership.business.id)
    .single();
  if (!program) {
    return { error: dict.dashboard.programs.delete.notFoundError };
  }
  if (program.active) {
    return { error: dict.dashboard.programs.delete.activeError };
  }

  // The SELECT above and this DELETE are two separate round-trips, so a
  // concurrent `toggleProgramActive(programId, true)` (another admin/tab, or
  // a double-click) can flip the row back to active in between — the early
  // check alone can't close that window. `.eq("active", false)` makes the
  // DELETE itself self-guarding: the database only deletes the row if it's
  // still inactive at delete time, atomically. `count: "exact"` lets us tell
  // "deleted" apart from "matched nothing" so a lost race surfaces as an
  // error instead of silently no-op'ing and redirecting as if it worked.
  const { error, count } = await supabase
    .from("programs")
    .delete({ count: "exact" })
    .eq("id", programId)
    .eq("business_id", membership.business.id)
    .eq("active", false);
  if (error) return { error: error.message };
  if (!count) {
    // Lost the race: the program was re-enabled between the check and the
    // delete. `activeError` is the accurate message for the common cause.
    return { error: dict.dashboard.programs.delete.activeError };
  }

  captureServerEvent({
    distinctId: user.id,
    event: "program_deleted",
    properties: { program_id: programId },
    groups: { business: membership.business.id },
  });

  revalidatePath("/dashboard/cards");
  redirect("/dashboard/cards?deleted=1");
}
