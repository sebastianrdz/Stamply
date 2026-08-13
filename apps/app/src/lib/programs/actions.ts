"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary, type Dictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import {
  assertWithinLimit,
  LimitExceededError,
} from "@/lib/billing/entitlements";

export interface ProgramFormState {
  error?: string;
}

/** Maximum stamps a stamp-type card can require — the stamp grid renders at
 *  most 10 slots, so goals above this aren't allowed for stamp programs. */
const MAX_STAMP_GOAL = 10;

/** Shared create/update validation. Stamp programs are capped at 10 stamps;
 *  points programs keep the generous 1000 ceiling. */
function programSchema(dict: Dictionary) {
  return z
    .object({
      name: z
        .string()
        .min(2, dict.dashboard.programs.errors.nameRequired)
        .max(80),
      type: z.enum(["stamp", "points"]),
      goal: z.coerce
        .number()
        .int()
        .min(1, dict.dashboard.programs.errors.goalMin)
        .max(1000),
      reward_description: z
        .string()
        .min(2, dict.dashboard.programs.errors.rewardRequired)
        .max(200),
    })
    .superRefine((val, ctx) => {
      if (val.type === "stamp" && val.goal > MAX_STAMP_GOAL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["goal"],
          message: dict.dashboard.programs.errors.stampGoalMax,
        });
      }
    });
}

export async function createProgram(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const { membership } = await requireRole(["owner", "admin"]);
  const business = membership.business;
  const dict = await getDictionary(await getLocale());

  const parsed = programSchema(dict).safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    goal: formData.get("goal"),
    reward_description: formData.get("reward_description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

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

  const { error } = await supabase.from("programs").insert({
    business_id: business.id,
    name: parsed.data.name,
    type: parsed.data.type,
    goal: parsed.data.goal,
    reward_description: parsed.data.reward_description,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/programs");
  redirect("/dashboard/programs");
}

export async function toggleProgramActive(programId: string, active: boolean) {
  const { membership } = await requireRole(["owner", "admin"]);
  const supabase = await createClient();
  await supabase
    .from("programs")
    .update({ active })
    .eq("id", programId)
    .eq("business_id", membership.business.id);
  revalidatePath("/dashboard/programs");
  revalidatePath(`/dashboard/programs/${programId}`);
}

export async function updateProgram(
  programId: string,
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const { membership } = await requireRole(["owner", "admin"]);
  const business = membership.business;
  const dict = await getDictionary(await getLocale());

  const parsed = programSchema(dict).safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    goal: formData.get("goal"),
    reward_description: formData.get("reward_description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("programs")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      goal: parsed.data.goal,
      reward_description: parsed.data.reward_description,
    })
    .eq("id", programId)
    .eq("business_id", business.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/programs");
  revalidatePath(`/dashboard/programs/${programId}`);
  redirect(`/dashboard/programs/${programId}`);
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
  const { membership } = await requireRole(["owner", "admin"]);
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

  revalidatePath("/dashboard/programs");
  redirect("/dashboard/programs");
}
