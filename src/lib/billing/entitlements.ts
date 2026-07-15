import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PlanTier } from "@/types/database";
import { isWithinLimit, planLimit, type LimitedResource } from "./plans";

type Client = SupabaseClient<Database>;

/** Current count of a limited resource for a business. */
export async function currentCount(
  supabase: Client,
  businessId: string,
  resource: LimitedResource,
): Promise<number> {
  // Literal table names (not a union) keep the query builder concretely typed.
  const head = { count: "exact" as const, head: true };

  const query =
    resource === "employees"
      ? supabase
          .from("memberships")
          .select("id", head)
          .eq("business_id", businessId)
      : resource === "locations"
        ? supabase
            .from("locations")
            .select("id", head)
            .eq("business_id", businessId)
        : resource === "customers"
          ? supabase
              .from("customers")
              .select("id", head)
              .eq("business_id", businessId)
          : supabase
              .from("programs")
              .select("id", head)
              .eq("business_id", businessId);

  const { count } = await query;
  return count ?? 0;
}

export class LimitExceededError extends Error {
  constructor(
    public resource: LimitedResource,
    public plan: PlanTier,
    public limit: number,
  ) {
    super(`Your plan allows ${limit} ${resource}. Upgrade to add more.`);
    this.name = "LimitExceededError";
  }
}

/**
 * Throw LimitExceededError if adding `additional` of `resource` would exceed the
 * plan. Call before creating locations / employees / customers / programs.
 */
export async function assertWithinLimit(
  supabase: Client,
  business: { id: string; plan: PlanTier },
  resource: LimitedResource,
  additional = 1,
): Promise<void> {
  const limit = planLimit(business.plan, resource);
  if (limit === null) return; // unlimited
  const count = await currentCount(supabase, business.id, resource);
  if (!isWithinLimit(business.plan, resource, count, additional)) {
    throw new LimitExceededError(resource, business.plan, limit);
  }
}
