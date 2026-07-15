"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertWithinLimit,
  LimitExceededError,
} from "@/lib/billing/entitlements";
import { issueCard } from "@/lib/cards/issue";
import type { Business, Program } from "@/types/database";

const schema = z.object({
  program_id: z.string().uuid(),
  full_name: z.string().min(1, "Please enter your name.").max(120),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  marketing_consent: z
    .union([z.literal("on"), z.null()])
    .transform((v) => v === "on"),
});

export interface EnrollState {
  error?: string;
}

/**
 * Public enrollment: create (or reuse) a customer for the program's business and
 * issue a card, then send them to their card page. Runs with the service-role
 * client because the enrollee is unauthenticated.
 */
export async function enroll(
  _prev: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
  const parsed = schema.safeParse({
    program_id: formData.get("program_id"),
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    marketing_consent: formData.get("marketing_consent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();

  const { data: programData } = await admin
    .from("programs")
    .select("*, business:businesses(*)")
    .eq("id", parsed.data.program_id)
    .single();

  if (!programData) return { error: "This loyalty program was not found." };
  const program = programData as unknown as Program & { business: Business };
  const business = program.business;

  if (!program.active) {
    return { error: "This program is not currently accepting new members." };
  }

  const email = parsed.data.email || null;

  // Reuse an existing customer for this business by email, if provided.
  let customerId: string | null = null;
  if (email) {
    const { data: existing } = await admin
      .from("customers")
      .select("id")
      .eq("business_id", business.id)
      .ilike("email", email)
      .maybeSingle();
    customerId = existing?.id ?? null;
  }

  if (!customerId) {
    try {
      await assertWithinLimit(admin, business, "customers");
    } catch (e) {
      if (e instanceof LimitExceededError) {
        return { error: "This business has reached its customer limit." };
      }
      throw e;
    }

    const { data: customer, error: customerError } = await admin
      .from("customers")
      .insert({
        business_id: business.id,
        full_name: parsed.data.full_name,
        email,
        phone: parsed.data.phone || null,
        marketing_consent: parsed.data.marketing_consent,
        consent_at: parsed.data.marketing_consent
          ? new Date().toISOString()
          : null,
      })
      .select("id")
      .single();
    if (customerError || !customer) {
      return { error: customerError?.message ?? "Could not enroll." };
    }
    customerId = customer.id;
  }

  const card = await issueCard(admin, {
    businessId: business.id,
    programId: program.id,
    customerId,
  });

  redirect(`/c/${card.pass_auth_token}`);
}
