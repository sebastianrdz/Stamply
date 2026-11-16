-- Wallet push delivery that survives big audiences (broadcast scale plan,
-- docs/product/plan-broadcast-scale.md). Instead of pushing to every pass
-- inside the request, the request records the work and a worker drains it in
-- small leased batches, so a broadcast to 25,000 passes can't time out
-- half-way and a retry never re-sends.
--
-- 1. Offers: wallet_offer_recipients (one row per consenting customer, created
--    by trigger) becomes the delivery ledger.
-- 2. Program-wide pass refreshes (design changes): wallet_refresh_queue lists
--    the cards that still need a refresh. A separate table, not a flag on
--    cards, because any update to cards bumps updated_at (trigger), which
--    would make Apple devices refetch passes that didn't change.

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------
-- 'pending' = the worker still has recipients to deliver; 'done' = nothing left
-- (also the default, so every existing and inline-delivered offer is done).
alter table wallet_offers
  add column delivery text not null default 'done'
    check (delivery in ('pending', 'done'));
create index on wallet_offers (created_at) where delivery = 'pending';

alter table wallet_offer_recipients
  add column delivered_at  timestamptz,
  add column attempts      int not null default 0,
  add column claimed_until timestamptz,
  add column last_error    text check (last_error is null or char_length(last_error) <= 200);

-- Everything recorded before this migration was delivered inline.
update wallet_offer_recipients set delivered_at = sent_at where delivered_at is null;

create index on wallet_offer_recipients (offer_id) where delivered_at is null;

-- Same recipients as 0029 (consenting customers only; keep in sync with
-- sendWalletOffers), but rows of offers delivered inline start out delivered.
create or replace function wallet_offers_fill_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into wallet_offer_recipients (offer_id, customer_id, business_id, sent_at, delivered_at)
  select new.id, c.id, new.business_id, new.created_at,
         case when new.delivery = 'pending' then null else new.created_at end
    from customers c
   where c.business_id = new.business_id
     and c.marketing_consent
     and (new.customer_id is null or c.id = new.customer_id)
  on conflict do nothing;
  return new;
end $$;
revoke all on function wallet_offers_fill_recipients() from public, anon, authenticated;

-- Take up to p_limit undelivered recipients of an offer for p_lease_seconds.
-- skip locked + the lease let several workers run at once without overlap; a
-- crashed worker's rows become claimable again when the lease expires. Each
-- claim counts as an attempt; after p_max_attempts the row is left for good.
create or replace function claim_offer_recipients(
  p_offer_id uuid, p_limit int, p_lease_seconds int, p_max_attempts int default 3
) returns table (offer_id uuid, customer_id uuid)
language sql
as $$
  with picked as (
    select r.offer_id, r.customer_id
      from wallet_offer_recipients r
     where r.offer_id = p_offer_id
       and r.delivered_at is null
       and r.attempts < p_max_attempts
       and (r.claimed_until is null or r.claimed_until < now())
     order by r.customer_id
     limit p_limit
       for update skip locked
  )
  update wallet_offer_recipients r
     set claimed_until = now() + make_interval(secs => p_lease_seconds),
         attempts = r.attempts + 1
    from picked
   where r.offer_id = picked.offer_id and r.customer_id = picked.customer_id
  returning r.offer_id, r.customer_id;
$$;

-- delivered = reached; pending = still to do or being delivered right now;
-- failed = gave up after p_max_attempts.
create or replace function offer_delivery_status(p_offer_id uuid, p_max_attempts int default 3)
returns table (delivered bigint, pending bigint, failed bigint)
language sql
stable
as $$
  select count(*) filter (where r.delivered_at is not null),
         count(*) filter (where r.delivered_at is null
                            and (r.attempts < p_max_attempts or r.claimed_until > now())),
         count(*) filter (where r.delivered_at is null
                            and r.attempts >= p_max_attempts
                            and (r.claimed_until is null or r.claimed_until <= now()))
    from wallet_offer_recipients r
   where r.offer_id = p_offer_id;
$$;

-- Mark the offer done once nothing is pending (failures don't keep it open).
create or replace function finish_offer_delivery(p_offer_id uuid, p_max_attempts int default 3)
returns boolean
language sql
as $$
  with done as (
    update wallet_offers o
       set delivery = 'done'
     where o.id = p_offer_id
       and o.delivery = 'pending'
       and not exists (
         select 1 from wallet_offer_recipients r
          where r.offer_id = o.id
            and r.delivered_at is null
            and (r.attempts < p_max_attempts or r.claimed_until > now())
       )
    returning 1
  )
  select exists (select 1 from done);
$$;

-- ---------------------------------------------------------------------------
-- Program-wide pass refreshes
-- ---------------------------------------------------------------------------
create table wallet_refresh_queue (
  card_id       uuid primary key references cards (id) on delete cascade,
  business_id   uuid not null references businesses (id) on delete cascade,
  program_id    uuid not null references programs (id) on delete cascade,
  requested_at  timestamptz not null default now(),
  claimed_until timestamptz,
  attempts      int not null default 0,
  last_error    text check (last_error is null or char_length(last_error) <= 200)
);
create index on wallet_refresh_queue (requested_at);
create index on wallet_refresh_queue (program_id);

alter table wallet_refresh_queue enable row level security;
-- Members may read the backlog (progress UI); only the service role writes.
create policy wallet_refresh_queue_select on wallet_refresh_queue for select
  using (business_id in (select auth_business_ids()));

-- Queue every card of a program (design changed): bumps cards.updated_at so
-- Apple's refetch sees a change, then lists each card. Calling it again before
-- the worker finishes just resets the entries. Returns how many cards.
create or replace function request_program_wallet_refresh(p_program_id uuid)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  update cards set updated_at = now() where program_id = p_program_id;

  insert into wallet_refresh_queue (card_id, business_id, program_id)
  select k.id, k.business_id, k.program_id from cards k where k.program_id = p_program_id
  on conflict (card_id) do update
    set requested_at = now(), claimed_until = null, attempts = 0, last_error = null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Same leasing contract as claim_offer_recipients, oldest request first.
create or replace function claim_wallet_refresh(
  p_limit int, p_lease_seconds int, p_max_attempts int default 3
) returns table (card_id uuid)
language sql
as $$
  with picked as (
    select q.card_id
      from wallet_refresh_queue q
     where q.attempts < p_max_attempts
       and (q.claimed_until is null or q.claimed_until < now())
     order by q.requested_at, q.card_id
     limit p_limit
       for update skip locked
  )
  update wallet_refresh_queue q
     set claimed_until = now() + make_interval(secs => p_lease_seconds),
         attempts = q.attempts + 1
    from picked
   where q.card_id = picked.card_id
  returning q.card_id;
$$;

create or replace function wallet_refresh_status(p_program_id uuid, p_max_attempts int default 3)
returns table (pending bigint, failed bigint)
language sql
stable
as $$
  select count(*) filter (where q.attempts < p_max_attempts or q.claimed_until > now()),
         count(*) filter (where q.attempts >= p_max_attempts
                            and (q.claimed_until is null or q.claimed_until <= now()))
    from wallet_refresh_queue q
   where q.program_id = p_program_id;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Workers and the app's server code run as service_role; dashboards
-- read progress through the invoker-rights status functions (RLS applies).
-- ---------------------------------------------------------------------------
revoke all on function claim_offer_recipients(uuid, int, int, int) from public, anon, authenticated;
grant execute on function claim_offer_recipients(uuid, int, int, int) to service_role;
revoke all on function finish_offer_delivery(uuid, int) from public, anon, authenticated;
grant execute on function finish_offer_delivery(uuid, int) to service_role;
revoke all on function request_program_wallet_refresh(uuid) from public, anon, authenticated;
grant execute on function request_program_wallet_refresh(uuid) to service_role;
revoke all on function claim_wallet_refresh(int, int, int) from public, anon, authenticated;
grant execute on function claim_wallet_refresh(int, int, int) to service_role;

revoke all on function offer_delivery_status(uuid, int) from public, anon;
grant execute on function offer_delivery_status(uuid, int) to authenticated, service_role;
revoke all on function wallet_refresh_status(uuid, int) from public, anon;
grant execute on function wallet_refresh_status(uuid, int) to authenticated, service_role;
