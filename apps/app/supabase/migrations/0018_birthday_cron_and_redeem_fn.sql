-- Birthday-reward support functions:
--   1. customers_with_birthday_this_month() -- daily scan a server-side job
--      (cron / scheduled route) calls to find who to grant a birthday
--      reward to, evaluated in each business's own timezone. The reward is
--      redeemable for the customer's ENTIRE birthday month (e.g. a
--      1990-08-28 birthday matches all of August), not just the exact day
--      -- this matches only on month, not day, and the once-per-year unique
--      constraint on standalone_reward_grants (customer_id,
--      reward_definition_id, period_key) means whichever day of the month
--      the cron first sees the match, it grants once and the grant then
--      stays available (redeemable) for the rest of that month.
--   2. redeem_standalone_reward() -- SECURITY DEFINER RPC that redeems one
--      standalone_reward_grants row, mirroring redeem_card's
--      lock-then-check-then-update shape (0002/0012).
--
-- Both are locked down to service_role only, following the 0008 precedent:
-- a new SECURITY DEFINER (or otherwise privileged) RPC must have its grants
-- revoked from public/anon/authenticated in the SAME migration that creates
-- it, so there's no window where it's callable by anyone holding the anon
-- key.

-- customers_with_birthday_this_month is plain `stable sql`, not `security
-- definer`. It doesn't need to bypass RLS itself: it's granted only to
-- service_role below, and the service-role Postgres role already bypasses
-- RLS at the database level regardless of what the function's own security
-- context is. (Contrast with redeem_standalone_reward, which DOES need
-- SECURITY DEFINER, because without it a call arriving via PostgREST as
-- `authenticated` would run under that caller's RLS -- but
-- standalone_reward_grants has no insert/update policy at all for
-- authenticated, so the UPDATE would silently affect 0 rows instead of
-- redeeming.)
create or replace function customers_with_birthday_this_month()
returns setof customers
language sql
stable
as $$
  select c.*
  from customers c
  join businesses b on b.id = c.business_id
  where c.birthday is not null
    and extract(month from c.birthday) = extract(month from (now() at time zone b.timezone));
$$;
revoke all on function customers_with_birthday_this_month() from public, anon, authenticated;
grant execute on function customers_with_birthday_this_month() to service_role;

-- redeem_standalone_reward: consumes one available grant.
--
-- p_location_id is accepted for signature parity with redeem_card(uuid,
-- uuid, uuid) but intentionally unused in the body: standalone_reward_grants
-- has no location_id column (no standalone-reward table has one), so there
-- is nowhere to store it. Kept as a parameter only so callers have one
-- consistent redeem-RPC calling convention; not wired to a column.
create or replace function redeem_standalone_reward(
  p_grant_id uuid,
  p_employee_id uuid,
  p_location_id uuid default null
) returns standalone_reward_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant standalone_reward_grants;
begin
  select * into v_grant from standalone_reward_grants where id = p_grant_id and status = 'available' for update;
  if not found then
    raise exception 'not_redeemable';
  end if;
  update standalone_reward_grants
    set status = 'redeemed', redeemed_at = now(), redeemed_by = p_employee_id
    where id = p_grant_id
    returning * into v_grant;
  return v_grant;
end;
$$;
revoke all on function redeem_standalone_reward(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function redeem_standalone_reward(uuid, uuid, uuid) to service_role;
