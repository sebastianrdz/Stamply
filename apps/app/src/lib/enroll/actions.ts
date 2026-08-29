"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertWithinLimit,
  LimitExceededError,
} from "@/lib/billing/entitlements";
import { issueCard } from "@/lib/cards/issue";
import { rateLimit } from "@/lib/rate-limit";
import { captureServerEvent } from "@/lib/posthog/server";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import type { Business, Program } from "@/types/database";

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
  const dict = await getDictionary(await getLocale());
  const schema = z.object({
    program_id: z.string().uuid(),
    full_name: z
      .string()
      .min(1, dict.customerJoin.errors.nameRequired)
      .max(120),
    email: z
      .string()
      .email(dict.customerJoin.errors.emailInvalid)
      .optional()
      .or(z.literal("")),
    phone: z.string().max(40).optional().or(z.literal("")),
    marketing_consent: z
      .union([z.literal("on"), z.null()])
      .transform((v) => v === "on"),
    birthday: z
      .string()
      .min(1, dict.customerJoin.errors.birthdayRequired)
      .superRefine((v, ctx) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: dict.customerJoin.errors.birthdayInvalid,
          });
          return;
        }
        const d = new Date(v);
        if (
          Number.isNaN(d.getTime()) ||
          d > new Date() ||
          d.getFullYear() <= 1900
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: dict.customerJoin.errors.birthdayInvalid,
          });
        }
      }),
  });
  const parsed = schema.safeParse({
    program_id: formData.get("program_id"),
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    marketing_consent: formData.get("marketing_consent"),
    birthday: formData.get("birthday"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // `x-forwarded-for`'s leftmost entry is the client IP only if the platform
  // sets/overwrites this header itself rather than appending to a
  // caller-supplied value — true on Vercel (the deploy target this assumes).
  // Self-hosting behind a different proxy should confirm the same convention
  // holds, or prefer that platform's own trusted-client-IP header instead.
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  if (!ip) {
    console.warn(
      "[enroll] missing x-forwarded-for; rate-limiting by program only for this request",
    );
  }

  // Key by program *and* IP, not IP alone: a missing/unresolvable IP still
  // scopes the bucket to this one program rather than collapsing every
  // header-less enrollment platform-wide into a single shared budget (which
  // would let one client lock out every business at once). In-store kiosk
  // enrollment often puts many customers behind one NAT'd IP, so the limit
  // here is generous enough for a busy counter while still bounding abuse to
  // a single business's program.
  const rateLimitKey = `enroll:${parsed.data.program_id}:${ip ?? "no-ip"}`;
  if (!(await rateLimit(rateLimitKey, 20, 5 * 60 * 1000))) {
    return { error: dict.customerJoin.errors.tooManyAttempts };
  }

  const admin = createAdminClient();

  const { data: programData } = await admin
    .from("programs")
    .select("*, business:businesses(*)")
    .eq("id", parsed.data.program_id)
    .single();

  if (!programData) {
    return { error: dict.customerJoin.errors.programNotFound };
  }
  const program = programData as unknown as Program & { business: Business };
  const business = program.business;

  if (!program.active) {
    return { error: dict.customerJoin.errors.programInactive };
  }

  const email = parsed.data.email || null;

  // Reuse an existing customer for this business by email, if provided.
  let customerId: string | null = null;
  let isNewCustomer = false;
  if (email) {
    const { data: existing } = await admin
      .from("customers")
      .select("id")
      .eq("business_id", business.id)
      .ilike("email", email)
      .maybeSingle();
    customerId = existing?.id ?? null;

    // Best-effort birthday backfill for a returning customer. The `birthday`
    // field is required on submission, so this only fills in customers who
    // don't already have one on file (see the `.is("birthday", null)` guard
    // below). Never fails the enrollment over this.
    if (customerId) {
      const { error: backfillError } = await admin
        .from("customers")
        .update({ birthday: parsed.data.birthday })
        .eq("id", customerId)
        .is("birthday", null);
      if (backfillError) {
        console.error("[enroll] birthday backfill failed", backfillError);
      }
    }
  }

  if (!customerId) {
    try {
      await assertWithinLimit(admin, business, "customers");
    } catch (e) {
      if (e instanceof LimitExceededError) {
        return { error: dict.customerJoin.errors.customerLimitReached };
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
        birthday: parsed.data.birthday,
        marketing_consent: parsed.data.marketing_consent,
        consent_at: parsed.data.marketing_consent
          ? new Date().toISOString()
          : null,
      })
      .select("id")
      .single();
    if (customerError || !customer) {
      return {
        error: customerError?.message ?? dict.customerJoin.errors.enrollFailed,
      };
    }
    customerId = customer.id;
    isNewCustomer = true;
  }

  // One card per customer per program: if this customer already enrolled in
  // this program, send them to that existing card instead of creating a
  // duplicate. (Only reachable when the customer was matched by email above;
  // a brand-new customer has no prior cards.)
  const { data: existingCard } = await admin
    .from("cards")
    .select("pass_auth_token")
    .eq("business_id", business.id)
    .eq("program_id", program.id)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (existingCard) {
    redirect(`/c/${existingCard.pass_auth_token}`);
  }

  const card = await issueCard(admin, {
    businessId: business.id,
    programId: program.id,
    customerId,
  });

  captureServerEvent({
    distinctId: customerId,
    event: "customer_enrolled",
    properties: {
      program_id: program.id,
      program_type: program.type,
      is_new_customer: isNewCustomer,
    },
    groups: { business: business.id },
  });

  redirect(`/c/${card.pass_auth_token}`);
}
