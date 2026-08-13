-- Make the Stripe webhook's out-of-order-delivery guard atomic.
--
-- 0006 added `subscriptions.last_event_created_at` and had the webhook route
-- read it, compare in app code, then issue two separate writes
-- (businesses.update + subscriptions.upsert). Under concurrent serverless
-- invocations (Stripe can deliver events for the same subscription to
-- overlapping requests), that's a check-then-act race: two events can both
-- pass the read-time guard before either writes, and the stale one can land
-- last, regressing both the businesses row and the stored guard value.
--
-- This migration moves the compare-and-set into the database as a single
-- SECURITY DEFINER function so each write is gated by its own atomic,
-- conditional UPDATE/UPSERT — not a separate read followed by a write.

-- A resubscribe creates a brand-new stripe_subscription_id with its own,
-- unguarded last_event_created_at history. Guarding only the `subscriptions`
-- row (keyed by stripe_subscription_id) doesn't protect the *shared*
-- `businesses.plan`/`subscription_status` columns from a late terminal event
-- on a superseded subscription clobbering state a newer subscription already
-- wrote. Add an independent guard column on `businesses` itself so that
-- write is gated on its own timeline, regardless of which subscription id
-- produced it.
alter table businesses
  add column last_billing_event_at timestamptz;

-- Atomically apply a Stripe subscription sync, skipping (per-write) any
-- event older than what's already been applied. Returns true if either the
-- subscriptions row or the businesses row was actually written.
create or replace function sync_subscription_if_newer(
  p_business_id            uuid,
  p_stripe_subscription_id text,
  p_plan                   plan_tier,
  p_status                 subscription_status,
  p_current_period_end     timestamptz,
  p_event_created_at       timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_applied boolean := false;
  v_biz_applied boolean := false;
begin
  -- Conditional upsert: the ON CONFLICT ... WHERE clause makes the update
  -- itself the compare-and-set — if a concurrent transaction already applied
  -- a same-or-newer event, this one is a no-op (not merely "do nothing",
  -- genuinely skipped by Postgres before any row is touched). Equal
  -- timestamps are allowed through (>=) so two distinct events that land in
  -- the same second aren't silently dropped.
  insert into subscriptions (
    business_id, stripe_subscription_id, plan, status,
    current_period_end, last_event_created_at
  )
  values (
    p_business_id, p_stripe_subscription_id, p_plan, p_status,
    p_current_period_end, p_event_created_at
  )
  on conflict (stripe_subscription_id) do update
    set business_id           = excluded.business_id,
        plan                  = excluded.plan,
        status                = excluded.status,
        current_period_end    = excluded.current_period_end,
        last_event_created_at = excluded.last_event_created_at
    where subscriptions.last_event_created_at is null
       or excluded.last_event_created_at >= subscriptions.last_event_created_at
  returning true into v_sub_applied;

  -- Independent, equally atomic guard for the businesses row (see comment
  -- above the column addition for why this can't just reuse the subscription
  -- row's guard).
  update businesses
     set plan                   = p_plan,
         subscription_status    = p_status,
         last_billing_event_at  = p_event_created_at
   where id = p_business_id
     and (last_billing_event_at is null or p_event_created_at >= last_billing_event_at)
  returning true into v_biz_applied;

  return coalesce(v_sub_applied, false) or coalesce(v_biz_applied, false);
end;
$$;
