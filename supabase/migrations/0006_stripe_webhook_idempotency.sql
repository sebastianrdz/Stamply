-- Stripe webhook idempotency + out-of-order delivery guard.
--
-- Stripe may redeliver the same event (retries) or deliver events out of
-- order. Without protection, the webhook handler could blindly re-apply a
-- stale/duplicate event and overwrite a business's plan/subscription_status
-- with older data.

-- Exact-replay dedupe log: the webhook handler inserts the incoming Stripe
-- event's id here before processing it. A unique-violation on event_id means
-- "already processed this exact event, skip." Only ever touched via the
-- service-role/admin client (the webhook route has no user session), so RLS
-- is enabled with NO policies at all -- deny-all for anon/authenticated,
-- matching the existing service-role-only pattern used elsewhere.
create table stripe_webhook_events (
  event_id   text primary key,
  event_type text not null,
  created_at timestamptz not null default now()
);

alter table stripe_webhook_events enable row level security;

-- Out-of-order delivery guard: records the Stripe `event.created` timestamp
-- of the most recent event actually applied to this row, so the handler can
-- detect and skip a stale event (e.g. an old "past_due" event arriving after
-- a newer "active" one already landed).
alter table subscriptions
  add column last_event_created_at timestamptz;
