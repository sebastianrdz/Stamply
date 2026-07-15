"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  assertWithinLimit,
  LimitExceededError,
} from "@/lib/billing/entitlements";

const schema = z.object({
  name: z.string().min(2, "Give the program a name.").max(80),
  type: z.enum(["stamp", "points"]),
  goal: z.coerce.number().int().min(1, "Goal must be at least 1.").max(1000),
  reward_description: z.string().min(2, "Describe the reward.").max(200),
});

export interface ProgramFormState {
  error?: string;
}

export async function createProgram(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const { membership } = await requireBusiness();
  const business = membership.business;

  const parsed = schema.safeParse({
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
    if (e instanceof LimitExceededError) return { error: e.message };
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
  const supabase = await createClient();
  await supabase.from("programs").update({ active }).eq("id", programId);
  revalidatePath("/dashboard/programs");
}
