-- Periodic cleanup of stripe_webhook_events (idempotency/dedupe log).
--
-- 0006 introduced stripe_webhook_events purely as a short-lived Stripe
-- redelivery dedupe log -- the webhook handler inserts an event's id before
-- processing it so a retried/duplicate delivery hits the primary-key unique
-- violation and is skipped. Stripe does not redeliver an event indefinitely
-- (retries taper off over hours/days, not months), so nothing about this
-- table's *purpose* requires unbounded retention, and left unpruned it grows
-- forever with every webhook Stripe has ever sent this project.
--
-- This migration:
--   1. Adds cleanup_stripe_webhook_events(), a SECURITY DEFINER function that
--      deletes rows older than a named retention window (see the function
--      body for why SECURITY DEFINER is needed here).
--   2. Enables pg_cron (if available) and schedules that function to run
--      once a day.
--
-- Fallback if pg_cron isn't available in a given environment: pg_cron is a
-- trusted-extension on Supabase and normally just needs to be turned on via
-- the dashboard (Database > Extensions) or the project's extension allowlist
-- -- but that's a per-project/per-environment operation this migration can't
-- perform on your behalf, and some environments (e.g. a plain self-hosted
-- Postgres without the pg_cron binary installed) won't have it at all. This
-- migration is written so that failure is non-fatal: the DELETE-issuing
-- function is created unconditionally and works standalone, independent of
-- whether pg_cron ends up scheduled. If pg_cron isn't available, the exact
-- same cleanup can still be triggered by:
--   - calling `select cleanup_stripe_webhook_events();` by hand (as
--     service_role/postgres) whenever needed, or
--   - an external scheduler invoking it on a timer -- e.g. a Vercel Cron Job
--     hitting an internal, admin-only Next.js route that runs the same query
--     via the service-role client, or a scheduled Supabase Edge Function.
-- None of that external-scheduler wiring is built here; this migration only
-- makes sure the underlying cleanup is a single safe, callable unit either
-- way.

-- Enable pg_cron if this Postgres instance has it available. Wrapped in a
-- DO block with an exception handler (rather than a bare
-- `create extension if not exists`) because IF NOT EXISTS only guards the
-- "already enabled" case -- it does NOT prevent an error if the pg_cron
-- extension files simply aren't installed on this instance, or if the
-- executing role lacks privilege to create extensions (both are plausible
-- across different Supabase projects/environments). Catching those specific
-- conditions here means a project without pg_cron enabled still gets the
-- rest of this migration (the cleanup function) applied instead of the
-- whole migration aborting.
do $$
begin
  create extension if not exists pg_cron;
exception
  when insufficient_privilege then
    raise notice
      'pg_cron: insufficient privilege to create extension -- skipping cron schedule for stripe_webhook_events cleanup. Enable pg_cron via the Supabase dashboard (Database > Extensions), then re-run: select cron.schedule(...) as below, or use the manual/external-scheduler fallback described in this migration''s top-of-file comment.';
  when undefined_file then
    raise notice
      'pg_cron: extension not available on this Postgres instance -- skipping cron schedule for stripe_webhook_events cleanup. Use the manual/external-scheduler fallback described in this migration''s top-of-file comment.';
end;
$$;

-- Deletes stripe_webhook_events rows past the retention window.
--
-- stripe_webhook_events has RLS enabled with NO policies at all (see 0006) --
-- deny-all for anon/authenticated, by design; it's only ever meant to be
-- touched by the service-role/admin client or trusted server-side code. A
-- plain `authenticated`/`anon`-role DELETE would be silently filtered down to
-- zero rows by RLS rather than actually pruning anything, so this needs
-- SECURITY DEFINER to run the DELETE as the function owner and bypass RLS,
-- the same reasoning 0007's sync_subscription_if_newer used for its writes.
create or replace function cleanup_stripe_webhook_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Retention window for stripe_webhook_events. This is a dedupe log, not
  -- business data -- 30 days is a generous safety margin past however long
  -- Stripe's own redelivery retries can plausibly run, not a retention
  -- requirement. Bump this one constant if that margin ever needs to change.
  retention_window constant interval := interval '30 days';
begin
  delete from stripe_webhook_events
   where created_at < now() - retention_window;
end;
$$;

-- Lock down execute the same way 0008 locked down the other SECURITY
-- DEFINER RPCs: Postgres grants EXECUTE on a new function to PUBLIC by
-- default, and PostgREST/Supabase would otherwise expose this as
-- `POST /rest/v1/rpc/cleanup_stripe_webhook_events`, callable by any client
-- holding the anon key. There's no per-tenant data at stake here (this table
-- has no business_id / RLS-scoped rows to leak), but there's also no reason
-- for anon/authenticated to be able to trigger a mass DELETE on demand, so
-- revoke from them for the same defense-in-depth reason as the other
-- definer functions.
--
-- service_role DOES get EXECUTE here (unlike a pure-internal helper): the
-- pg_cron job below runs as whatever role owns the scheduled job (typically
-- the migration-executing role, e.g. postgres, which bypasses grants
-- entirely as a superuser) -- so the schedule itself doesn't depend on this
-- grant. The grant to service_role exists to support the documented
-- fallback/complement path above (manual invocation, or an external
-- scheduler such as a Vercel Cron hitting an internal admin-only route)
-- calling this function through the service-role client when pg_cron isn't
-- scheduled or isn't available in a given environment.
revoke all on function cleanup_stripe_webhook_events() from public, anon, authenticated;
grant execute on function cleanup_stripe_webhook_events() to service_role;

-- Schedule the daily cleanup, but only if pg_cron actually ended up enabled
-- above (see the DO block earlier in this file). Guarded the same way here
-- for the same reason: an environment without pg_cron shouldn't fail this
-- migration outright.
--
-- Idempotency note: pg_cron's `cron.schedule(job_name, schedule, command)`
-- overload is documented upstream as updating an existing job when called
-- again with the same job_name, rather than creating a duplicate -- but
-- since that behavior isn't verifiable against a live instance in this
-- environment/pg_cron version, this migration doesn't rely on that
-- assumption. Instead it explicitly unschedules any prior job with this
-- exact name first, then schedules fresh, which is idempotent regardless of
-- which cron.schedule upsert semantics this project's pg_cron version has.
--
-- Schedule: '17 3 * * *' -- once daily at 03:17 UTC. Off-the-hour minute is
-- just jitter to avoid piling onto the :00 minute alongside every other
-- default-scheduled cron job on shared infrastructure; the exact time isn't
-- otherwise significant since this table has no read/write pressure that a
-- particular hour would relieve.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'cleanup-stripe-webhook-events') then
      perform cron.unschedule('cleanup-stripe-webhook-events');
    end if;

    perform cron.schedule(
      'cleanup-stripe-webhook-events',
      '17 3 * * *',
      $sched$select cleanup_stripe_webhook_events();$sched$
    );
  else
    raise notice
      'pg_cron extension not installed -- skipping cron.schedule for cleanup_stripe_webhook_events(). See this migration''s top-of-file comment for manual/external-scheduler fallback options.';
  end if;
end;
$$;
