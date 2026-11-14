-- Staff controls (D5 v1): a per-customer daily stamp limit and a per-employee
-- activity report. Read-side functions only; the stamp RPCs are untouched and
-- the limit is enforced in the scan route (like the cooldown).

-- null = no limit.
alter table businesses
  add column max_stamps_per_customer_per_day int
    check (max_stamps_per_customer_per_day is null
           or max_stamps_per_customer_per_day between 1 and 50);

-- An owner/admin stamped a customer who was already at the daily limit.
create table stamp_limit_overrides (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  card_id     uuid not null references cards (id) on delete cascade,
  employee_id uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on stamp_limit_overrides (business_id, created_at desc);

alter table stamp_limit_overrides enable row level security;
-- Select-only: rows are written by the scan route (service role).
create policy stamp_limit_overrides_select on stamp_limit_overrides for select
  using (business_id in (select auth_business_ids()));

-- Stamp events a customer got today (business-local day), across all their
-- cards in the business. A points `spend` scan is one event.
create or replace function customer_stamps_today(
  p_business_id uuid, p_customer_id uuid, p_tz text
) returns int
language sql
stable
as $$
  select count(*)::int
    from stamp_events e
    join cards k on k.id = e.card_id
   where e.business_id = p_business_id
     and k.customer_id = p_customer_id
     and e.kind = 'stamp'
     and e.created_at >= (date_trunc('day', now() at time zone p_tz)) at time zone p_tz;
$$;

-- Per staff member per local day. p_from/p_to are inclusive local dates.
-- Redemptions include standalone reward redeems (which have no stamp_event).
-- employee_id is null for events whose user was deleted.
create or replace function employee_activity(
  p_business_id uuid, p_from date, p_to date, p_tz text
) returns table (
  employee_id uuid, day date, stamps bigint, redemptions bigint, overrides bigint
)
language sql
stable
as $$
  with bounds as (
    select p_from::timestamp at time zone p_tz as lo,
           (p_to + 1)::timestamp at time zone p_tz as hi
  ),
  acts as (
    select e.employee_id, e.created_at as at,
           (e.kind = 'stamp')::int as stamps,
           (e.kind = 'redeem')::int as redemptions,
           0 as overrides
      from stamp_events e, bounds b
     where e.business_id = p_business_id
       and e.kind in ('stamp', 'redeem')
       and e.created_at >= b.lo and e.created_at < b.hi
    union all
    select g.redeemed_by, g.redeemed_at, 0, 1, 0
      from standalone_reward_grants g, bounds b
     where g.business_id = p_business_id
       and g.redeemed_at >= b.lo and g.redeemed_at < b.hi
    union all
    select o.employee_id, o.created_at, 0, 0, 1
      from stamp_limit_overrides o, bounds b
     where o.business_id = p_business_id
       and o.created_at >= b.lo and o.created_at < b.hi
  )
  select a.employee_id, (a.at at time zone p_tz)::date,
         sum(a.stamps)::bigint, sum(a.redemptions)::bigint, sum(a.overrides)::bigint
    from acts a
   group by 1, 2;
$$;

revoke all on function customer_stamps_today(uuid, uuid, text) from public, anon;
grant execute on function customer_stamps_today(uuid, uuid, text) to authenticated, service_role;
revoke all on function employee_activity(uuid, date, date, text) from public, anon;
grant execute on function employee_activity(uuid, date, date, text) to authenticated, service_role;
