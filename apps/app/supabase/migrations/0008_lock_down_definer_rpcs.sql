-- Lock down SECURITY DEFINER functions that must be service-role-only.
--
-- Postgres grants EXECUTE on a new function to PUBLIC by default, and
-- PostgREST/Supabase exposes every function in the `public` schema as
-- `POST /rest/v1/rpc/<name>`, callable by anyone holding the project's
-- anon key (as `anon`, or as `authenticated` once logged in). None of the
-- migrations that created these functions ever revoked that default grant,
-- so three privileged, RLS-bypassing SECURITY DEFINER functions have been
-- directly callable by any client since they were introduced:
--
--   - apply_stamp(uuid, uuid, integer, uuid)      (0002) — trusts p_card_id /
--     p_employee_id outright; a direct RPC call lets anyone stamp or
--     complete ANY card in ANY business.
--   - redeem_card(uuid, uuid, uuid)               (0002) — same shape; lets
--     anyone redeem any completed card in any business.
--   - sync_subscription_if_newer(uuid, text, plan_tier, subscription_status,
--     timestamptz, timestamptz)                    (0007) — lets anyone set
--     any business's plan/subscription_status to anything, for free.
--
-- All three are meant to be invoked only from trusted server code via the
-- service-role client (which bypasses PostgREST's RLS-and-grants model
-- entirely for its own key, but still goes through the same GRANT/REVOKE
-- surface at the Postgres level for RPC calls). Restrict execution to
-- `service_role` only.
--
-- Deliberately NOT touched: auth_business_ids() and is_business_admin(uuid)
-- are invoked from inside RLS policies and must stay executable by
-- `authenticated`; they're safe to expose since they only ever derive
-- results from auth.uid() and take no privileged/cross-tenant argument.
-- set_updated_at() is a trigger function, not part of the RPC surface.

revoke all on function apply_stamp(uuid, uuid, integer, uuid)
  from public, anon, authenticated;
grant execute on function apply_stamp(uuid, uuid, integer, uuid)
  to service_role;

revoke all on function redeem_card(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function redeem_card(uuid, uuid, uuid)
  to service_role;

revoke all on function sync_subscription_if_newer(
  uuid, text, plan_tier, subscription_status, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function sync_subscription_if_newer(
  uuid, text, plan_tier, subscription_status, timestamptz, timestamptz
) to service_role;
