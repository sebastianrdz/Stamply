-- ROI dashboard + message attribution (D1/D2). Read-side only: nothing here
-- touches the stamp/redeem RPCs; conversions are computed at read time.
--
-- Definitions (docs/product/plan-d1-d2.md):
--   visit-day  = distinct (customer, local date) with a stamp_events row of
--                kind stamp/redeem/checkin, or a standalone reward redemption.
--                'adjust' is not a visit.
--   returning  = a visit-day in the period AND an earlier visit-day.
--   attributed = a visit-day credited to the newest message the customer
--                received in the 7 days before it (last message wins).

alter table businesses
  add column average_ticket_cents int
    check (average_ticket_cents is null or average_ticket_cents between 1 and 100000000);

create index on stamp_events (business_id, created_at);

-- Who each wallet_offers row was actually delivered to. A broadcast to
-- everyone is one wallet_offers row with customer_id null, so the audience
-- is snapshotted here when the offer is created.
create table wallet_offer_recipients (
  offer_id    uuid not null references wallet_offers (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  sent_at     timestamptz not null,
  primary key (offer_id, customer_id)
);
create index on wallet_offer_recipients (business_id, customer_id, sent_at);

alter table wallet_offer_recipients enable row level security;
-- Select-only: rows are written by the trigger below.
create policy wallet_offer_recipients_select on wallet_offer_recipients for select
  using (business_id in (select auth_business_ids()));

-- Same consent rule as sendWalletOffers (src/lib/offers/send.ts): only
-- marketing_consent customers are ever messaged. Keep the two in sync.
create or replace function wallet_offers_fill_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into wallet_offer_recipients (offer_id, customer_id, business_id, sent_at)
  select new.id, c.id, new.business_id, new.created_at
    from customers c
   where c.business_id = new.business_id
     and c.marketing_consent
     and (new.customer_id is null or c.id = new.customer_id)
  on conflict do nothing;
  return new;
end $$;
revoke all on function wallet_offers_fill_recipients() from public, anon, authenticated;

create trigger wallet_offers_recipients
  after insert on wallet_offers
  for each row execute function wallet_offers_fill_recipients();

-- Backfill per-customer offers. Older broadcast-to-all offers can't be
-- reconstructed (who was opted in then is unknown), so they get no rows.
insert into wallet_offer_recipients (offer_id, customer_id, business_id, sent_at)
select o.id, o.customer_id, o.business_id, o.created_at
  from wallet_offers o
 where o.customer_id is not null
on conflict do nothing;

-- One row per customer visit event. security_invoker: the underlying tables'
-- RLS applies to the caller, so a session only sees its own business.
create view customer_visit_days with (security_invoker = true) as
  select e.business_id, k.customer_id, e.created_at as visit_at
    from stamp_events e
    join cards k on k.id = e.card_id
   where e.kind in ('stamp', 'redeem', 'checkin')
  union all
  select g.business_id, g.customer_id, g.redeemed_at
    from standalone_reward_grants g
   where g.redeemed_at is not null;
grant select on customer_visit_days to authenticated;

-- Period summary. p_from/p_to are inclusive local dates in p_tz. At-risk is
-- "now"-relative: last visit-day between N and 2N days ago (N = p_at_risk_days).
create or replace function roi_summary(
  p_business_id uuid, p_from date, p_to date, p_tz text, p_at_risk_days int
) returns table (
  active_customers bigint, returning_customers bigint, returning_visits bigint,
  avg_days_between numeric, at_risk bigint, attributed_visits bigint
)
language sql
stable
as $$
  with days as (
    select v.customer_id, (v.visit_at at time zone p_tz)::date as d, min(v.visit_at) as first_at
      from customer_visit_days v
     where v.business_id = p_business_id
     group by 1, 2
  ),
  seq as (
    select s.customer_id, s.d, s.first_at,
           s.d - lag(s.d) over (partition by s.customer_id order by s.d) as gap
      from days s
  ),
  period as (
    select * from seq where d between p_from and p_to
  ),
  last_visit as (
    select customer_id, max(d) as d from days group by 1
  )
  select
    (select count(distinct customer_id) from period),
    (select count(distinct customer_id) from period where gap is not null),
    (select count(*) from period where gap is not null),
    (select round(avg(gap), 1) from period where gap is not null),
    (select count(*) from last_visit l
      where (now() at time zone p_tz)::date - l.d >= p_at_risk_days
        and (now() at time zone p_tz)::date - l.d < 2 * p_at_risk_days),
    (select count(*) from period pr
      where exists (
        select 1 from wallet_offer_recipients r
         where r.business_id = p_business_id
           and r.customer_id = pr.customer_id
           and r.sent_at <= pr.first_at
           and r.sent_at > pr.first_at - interval '7 days'));
$$;

-- Sent / returned per message since p_since. Broadcasts come back one row each
-- (offer_id set, automation_id null); automation messages are grouped per
-- automation (offer_id null) so "returned" is distinct customers, not a sum.
create or replace function message_attribution(
  p_business_id uuid, p_since timestamptz, p_tz text
) returns table (offer_id uuid, automation_id uuid, sent bigint, returned bigint)
language sql
stable
as $$
  with days as (
    select v.customer_id, min(v.visit_at) as first_at
      from customer_visit_days v
     where v.business_id = p_business_id
     group by v.customer_id, (v.visit_at at time zone p_tz)::date
  ),
  credit as (
    select d.customer_id, m.offer_id
      from days d
      cross join lateral (
        select r.offer_id
          from wallet_offer_recipients r
         where r.business_id = p_business_id
           and r.customer_id = d.customer_id
           and r.sent_at >= p_since
           and r.sent_at <= d.first_at
           and r.sent_at > d.first_at - interval '7 days'
         order by r.sent_at desc, r.offer_id
         limit 1
      ) m
  ),
  msgs as (
    select o.id, o.automation_id,
           case when o.automation_id is null then o.id end as grp
      from wallet_offers o
     where o.business_id = p_business_id and o.created_at >= p_since
  ),
  sent_n as (
    select f.grp, f.automation_id, count(r.customer_id) as n
      from msgs f
      left join wallet_offer_recipients r on r.offer_id = f.id
     group by f.grp, f.automation_id
  ),
  returned_n as (
    select f.grp, f.automation_id, count(distinct c.customer_id) as n
      from credit c
      join msgs f on f.id = c.offer_id
     group by f.grp, f.automation_id
  )
  select s.grp, s.automation_id, s.n, coalesce(x.n, 0)
    from sent_n s
    left join returned_n x
      on x.grp is not distinct from s.grp
     and x.automation_id is not distinct from s.automation_id;
$$;

-- security invoker + RLS scope each caller to its own business; the cron
-- reads through the service role.
revoke all on function roi_summary(uuid, date, date, text, int) from public, anon;
grant execute on function roi_summary(uuid, date, date, text, int) to authenticated, service_role;
revoke all on function message_attribution(uuid, timestamptz, text) from public, anon;
grant execute on function message_attribution(uuid, timestamptz, text) to authenticated, service_role;
