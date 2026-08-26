"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { ACTIVE_BUSINESS_COOKIE, requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/billing/stripe";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";

const ASSET_BUCKET = "business-assets";

// Terminal statuses (mirrors findLiveSubscription in billing/actions.ts): a
// subscription in one of these is over and doesn't need to be canceled.
const TERMINAL_SUBSCRIPTION_STATUSES: ReadonlySet<Stripe.Subscription.Status> =
  new Set(["canceled", "incomplete_expired"]);

function isLiveSubscription(status: Stripe.Subscription.Status): boolean {
  return !TERMINAL_SUBSCRIPTION_STATUSES.has(status);
}

export interface DeleteBusinessState {
  error?: string;
}

/**
 * Permanently delete the active business: stop billing, remove its uploaded
 * assets, then hard-delete the row (which cascades every tenant table via FK).
 * Gated to the business owner. `formData` is unused — no confirmation text is
 * parsed here, that's the frontend's job — but kept in the signature to match
 * the `useActionState` action shape used elsewhere in this codebase.
 */
export async function deleteBusiness(
  _prev: DeleteBusinessState,
  _formData: FormData,
): Promise<DeleteBusinessState> {
  const dict = await getDictionary(await getLocale());
  const { user, membership } = await requireRole(["owner"]);
  const business = membership.business;

  // 1. Stop billing first. Must succeed (or have nothing to do) before we
  // touch storage or the business row — we never want to destroy the
  // business while it's still being billed.
  if (business.stripe_customer_id) {
    try {
      const client = stripe();
      const subscriptions = await client.subscriptions.list({
        customer: business.stripe_customer_id,
        status: "all",
        limit: 100,
      });
      const live = subscriptions.data.filter((sub) =>
        isLiveSubscription(sub.status),
      );
      for (const sub of live) {
        await client.subscriptions.cancel(sub.id);
      }
    } catch (e) {
      console.error("[businesses] failed to cancel subscriptions", e);
      return { error: dict.dashboard.settings.errors.stripeCancelFailed };
    }
  }

  // From here on we only need the service-role client: storage cleanup below
  // requires it (see comment), the business-row delete requires it (RLS has
  // no delete policy for the anon/authenticated role, only defense-in-depth
  // for a hypothetical non-admin caller), and the remaining-memberships
  // lookup after the delete needs a fresh, non-cached read (see step 4).
  const admin = createAdminClient();

  // 2. Clean up uploaded assets. Must succeed before the business row is
  // deleted, or the objects' business_id folder would no longer correspond to
  // any business and the files would leak forever with no way to remove them.
  //
  // Uses the ADMIN client, not the RLS-scoped one: `business-assets` storage
  // objects only have INSERT/UPDATE/DELETE policies (0003_business_assets.sql)
  // -- there is no SELECT policy. Postgres RLS with no matching policy hides
  // rows rather than erroring, so `.list()` under the RLS-scoped client would
  // silently return an empty array with `error: null` every time, `remove()`
  // would never run, and this whole step would look like a no-op success
  // while actually leaking every uploaded asset forever in a public bucket.
  // The admin client bypasses RLS entirely, which is safe here since we're
  // already past the requireRole(["owner"]) gate above.
  //
  // Paginated: `.list()` defaults to a 100-item page, and uploadAsset() in
  // settings-actions.ts never deletes the previous file on replace (every
  // branding update mints a new randomUUID()-named object), so a long-lived,
  // frequently-rebranded business can plausibly exceed one page.
  try {
    const paths: string[] = [];
    const PAGE_SIZE = 100;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: page, error: listError } = await admin.storage
        .from(ASSET_BUCKET)
        .list(business.id, { limit: PAGE_SIZE, offset });
      if (listError) throw listError;
      for (const obj of page ?? []) paths.push(`${business.id}/${obj.name}`);
      if (!page || page.length < PAGE_SIZE) break;
    }

    if (paths.length > 0) {
      const { error: removeError } = await admin.storage
        .from(ASSET_BUCKET)
        .remove(paths);
      if (removeError) throw removeError;
    }
  } catch (e) {
    console.error("[businesses] failed to clean up business assets", e);
    return { error: dict.dashboard.settings.errors.storageCleanupFailed };
  }

  // 3. Hard-delete the business row. `business.id` comes from the session's
  // active membership (already gated by requireRole(["owner"]) above), never
  // from client-submitted formData. Cascades memberships/locations/programs/
  // customers/cards/stamp_events/redemptions/apple_registrations/
  // subscriptions/invitations via FK.
  const { error } = await admin.from("businesses").delete().eq("id", business.id);
  if (error) {
    return {
      error: error.message || dict.dashboard.settings.errors.deleteBusinessFailed,
    };
  }

  // 4. Send the user to another business they belong to, or onboarding.
  //
  // Deliberately NOT `getMemberships()` from session.ts here: it's wrapped in
  // React's `cache()`, which was already primed (with the now-stale,
  // pre-delete membership list) earlier in this very invocation via
  // `requireRole` -> `requireBusiness` -> `getActiveBusiness`. Calling it
  // again would return that memoized array, still including the
  // just-deleted business, rather than a fresh read. Query the admin client
  // directly instead so this reflects the cascade delete that just happened.
  const { data: remaining } = await admin
    .from("memberships")
    .select("business_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const cookieStore = await cookies();
  if (remaining && remaining.length > 0) {
    cookieStore.set(ACTIVE_BUSINESS_COOKIE, remaining[0].business_id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    redirect("/dashboard");
  } else {
    cookieStore.delete(ACTIVE_BUSINESS_COOKIE);
    redirect("/onboarding");
  }
}
