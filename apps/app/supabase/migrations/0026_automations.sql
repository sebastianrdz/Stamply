-- Automations: reward_definitions is widened in place (name kept so the FKs
-- from standalone_reward_grants, the redeem RPC and existing birthday rows
-- keep working untouched). Types: welcome | birthday | unredeemed_reminder |
-- win_back | almost_there. The reward is now optional and each automation
-- carries a wallet-push `message`. Per-type settings live in `config`:
--   birthday: days_before, win_back: inactive_days,
--   almost_there: remaining, unredeemed_reminder: remind_every_days.
alter table reward_definitions drop constraint if exists reward_definitions_type_check;
alter table reward_definitions add constraint reward_definitions_type_check
  check (type in ('welcome', 'birthday', 'unredeemed_reminder', 'win_back', 'almost_there'));
alter table reward_definitions alter column reward_description drop not null;
alter table reward_definitions add column message text check (char_length(message) <= 200);

-- Offers sent by an automation are tagged so the feed shows them once (as
-- automation_sent), not also as a broadcast.
alter table wallet_offers add column automation_id uuid references reward_definitions (id) on delete set null;

-- One row per (automation, customer, period) actually sent: the unique key is
-- the idempotency guard (claim the row first, then push).
create table automation_runs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses (id) on delete cascade,
  automation_id uuid not null references reward_definitions (id) on delete cascade,
  customer_id   uuid not null references customers (id) on delete cascade,
  period_key    text not null,
  sent_at       timestamptz not null default now(),
  unique (automation_id, customer_id, period_key)
);
create index on automation_runs (business_id, sent_at desc);
create index on automation_runs (customer_id);
alter table automation_runs enable row level security;
-- Select-only: rows are written by trusted server code (service role).
create policy automation_runs_select on automation_runs for select
  using (business_id in (select auth_business_ids()));

-- Last time each customer of a business had any card activity (falling back to
-- the card's creation), for the win-back automation. Service role only.
create or replace function automation_last_visits(p_business_id uuid)
returns table (customer_id uuid, last_visit timestamptz)
language sql
stable
as $$
  select k.customer_id, max(coalesce(e.created_at, k.created_at)) as last_visit
    from cards k
    left join stamp_events e on e.card_id = k.id
   where k.business_id = p_business_id
   group by k.customer_id;
$$;
revoke all on function automation_last_visits(uuid) from public, anon, authenticated;
grant execute on function automation_last_visits(uuid) to service_role;

-- activity_feed gains an automation_runs branch (same 11 columns).
create or replace view activity_feed with (security_invoker = true) as
  select 'customer_joined:' || c.id as id,
         c.business_id, 'customer_joined'::text as type, c.created_at as occurred_at,
         c.id as customer_id, c.full_name as customer_name,
         null::uuid as card_id, null::text as program_name,
         c.source_location_id as location_id, null::integer as delta, null::text as detail
    from customers c
  union all
  select 'card_issued:' || k.id,
         k.business_id, 'card_issued', k.created_at,
         k.customer_id, c.full_name, k.id, p.name, null, null, null
    from cards k
    join customers c on c.id = k.customer_id
    join programs p on p.id = k.program_id
  union all
  select 'stamp_event:' || e.id,
         e.business_id, e.kind::text, e.created_at,
         k.customer_id, c.full_name, e.card_id, p.name, e.location_id, e.delta, null
    from stamp_events e
    join cards k on k.id = e.card_id
    join customers c on c.id = k.customer_id
    join programs p on p.id = k.program_id
  union all
  select 'reward_granted:' || g.id,
         g.business_id, 'reward_granted', g.granted_at,
         g.customer_id, c.full_name, null, null, null, null, d.reward_description
    from standalone_reward_grants g
    join customers c on c.id = g.customer_id
    join reward_definitions d on d.id = g.reward_definition_id
  union all
  select 'reward_redeemed:' || g.id,
         g.business_id, 'reward_redeemed', g.redeemed_at,
         g.customer_id, c.full_name, null, null, null, null, d.reward_description
    from standalone_reward_grants g
    join customers c on c.id = g.customer_id
    join reward_definitions d on d.id = g.reward_definition_id
   where g.redeemed_at is not null
  union all
  select 'broadcast:' || o.id,
         o.business_id, 'broadcast', o.created_at,
         o.customer_id, c.full_name, null, null, null, null, o.body
    from wallet_offers o
    left join customers c on c.id = o.customer_id
   where o.automation_id is null
  union all
  select 'automation_sent:' || r.id,
         r.business_id, 'automation_sent', r.sent_at,
         r.customer_id, c.full_name, null, null, null, null, d.type
    from automation_runs r
    join customers c on c.id = r.customer_id
    join reward_definitions d on d.id = r.automation_id;

grant select on activity_feed to authenticated;
