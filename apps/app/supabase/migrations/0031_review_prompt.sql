-- Google review prompt (D6). The owner stores a review link; a `review_prompt`
-- automation invites a customer after their first redeemed reward; every tap
-- goes through our /r/[token] redirect, which logs a click here.

-- https only; the host allow-list lives in the app (lib/reviews/url.ts).
alter table businesses
  add column google_review_url text
    check (google_review_url is null
           or (char_length(google_review_url) <= 500 and google_review_url ~ '^https://'));

alter table reward_definitions drop constraint if exists reward_definitions_type_check;
alter table reward_definitions add constraint reward_definitions_type_check
  check (type in ('welcome', 'birthday', 'unredeemed_reminder', 'win_back',
                  'almost_there', 'review_prompt'));

create table review_clicks (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  source      text not null check (source in ('message', 'card_page')),
  clicked_at  timestamptz not null default now()
);
create index on review_clicks (business_id, clicked_at desc);
create index on review_clicks (business_id, customer_id);

alter table review_clicks enable row level security;
-- Select-only: rows are written by the /r/[token] route (service role).
create policy review_clicks_select on review_clicks for select
  using (business_id in (select auth_business_ids()));

create or replace function review_clicks_summary(p_business_id uuid, p_since timestamptz)
returns table (clicks bigint, clickers bigint)
language sql
stable
as $$
  select count(*), count(distinct customer_id)
    from review_clicks
   where business_id = p_business_id and clicked_at >= p_since;
$$;
revoke all on function review_clicks_summary(uuid, timestamptz) from public, anon;
grant execute on function review_clicks_summary(uuid, timestamptz) to authenticated, service_role;

-- Messages that count for visit attribution (D2). A review invite goes out
-- right after a redemption, so crediting it would steal visits from real
-- win-back / offer messages and inflate "visits after a message".
create view attribution_recipients with (security_invoker = true) as
  select r.*
    from wallet_offer_recipients r
   where not exists (
     select 1
       from wallet_offers o
       join reward_definitions d on d.id = o.automation_id
      where o.id = r.offer_id and d.type = 'review_prompt'
   );
grant select on attribution_recipients to authenticated;

-- Same bodies as 0029 with wallet_offer_recipients -> attribution_recipients.
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
        select 1 from attribution_recipients r
         where r.business_id = p_business_id
           and r.customer_id = pr.customer_id
           and r.sent_at <= pr.first_at
           and r.sent_at > pr.first_at - interval '7 days'));
$$;

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
          from attribution_recipients r
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
