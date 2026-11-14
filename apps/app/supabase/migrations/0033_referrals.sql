-- Referral program (D3). Customers share a personal invite link; when the
-- referred friend gets their first scanned stamp, both get a bonus.
--
--  * cards.referral_code is the PUBLIC share code. Never put pass_auth_token
--    (a wallet bearer credential) in a link.
--  * Bonuses are written as stamp_events kind 'adjust' (no employee), so they
--    are not visits (roi_summary), staff activity (employee_activity) or daily
--    stamps (customer_stamps_today); those all look at stamp/redeem/checkin.
--  * pay_referral does claim + both grants in ONE transaction: idempotent
--    (a second call returns nothing), all-or-nothing, safe under concurrent
--    scans. Service role only.

alter table cards
  add column referral_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

-- Last 10 digits of the phone, to spot a returning number written differently
-- ("+52 55 1234 5678" vs "5512345678"). '' = no usable phone.
alter table customers
  add column phone_digits text
    generated always as (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)) stored;
create index on customers (business_id, phone_digits);

create table referrals (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references businesses (id) on delete cascade,
  program_id           uuid not null references programs (id) on delete cascade,
  referrer_card_id     uuid not null references cards (id) on delete cascade,
  referred_customer_id uuid not null unique references customers (id) on delete cascade,
  referred_card_id     uuid not null references cards (id) on delete cascade,
  status               text not null default 'pending'
                         check (status in ('pending', 'rewarded')),
  -- false when the referrer was at the monthly cap (the friend is still paid).
  referrer_paid        boolean not null default false,
  created_at           timestamptz not null default now(),
  rewarded_at          timestamptz,
  check (referrer_card_id <> referred_card_id)
);
create index on referrals (referrer_card_id, rewarded_at);
create index on referrals (referred_card_id);
create index on referrals (business_id, created_at desc);

alter table referrals enable row level security;
-- Select-only: rows are written by trusted server code (service role).
create policy referrals_select on referrals for select
  using (business_id in (select auth_business_ids()));

-- Internal: add a bonus to a stamp/points card with apply_stamp's balance and
-- reward math, recorded as an 'adjust' event. Called only by pay_referral.
create or replace function grant_card_bonus(p_card_id uuid, p_delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card    cards;
  v_program programs;
  v_old     integer;
  v_new     integer;
  v_rewards integer;
begin
  select * into v_card from cards where id = p_card_id for update;
  if not found then
    raise exception 'card_not_found';
  end if;
  select * into v_program from programs where id = v_card.program_id;
  if v_program.type not in ('stamp', 'points') then
    raise exception 'bonus_not_supported';
  end if;

  v_old := case when v_program.type = 'points' then v_card.points else v_card.stamps end;
  v_new := greatest(v_old + p_delta, 0);
  v_rewards := greatest(v_card.rewards + (v_new / v_program.goal) - (v_old / v_program.goal), 0);

  if v_program.type = 'points' then
    update cards set points = v_new, rewards = v_rewards,
      status = (case when v_rewards > 0 then 'completed' else 'active' end)::card_status
      where id = p_card_id;
  else
    update cards set stamps = v_new, rewards = v_rewards,
      status = (case when v_rewards > 0 then 'completed' else 'active' end)::card_status
      where id = p_card_id;
  end if;

  insert into stamp_events (business_id, card_id, employee_id, delta, kind)
  values (v_card.business_id, p_card_id, null, p_delta, 'adjust');
end;
$$;
revoke all on function grant_card_bonus(uuid, int) from public, anon, authenticated;
grant execute on function grant_card_bonus(uuid, int) to service_role;

-- Pay a pending referral: friend's bonus, plus the referrer's unless they have
-- already earned p_monthly_cap referral rewards this business-local month.
-- Returns no row when the referral isn't pending (already paid / unknown).
-- Lock order: referral, referrer card, friend card.
create or replace function pay_referral(
  p_referral_id uuid, p_referrer_bonus int, p_friend_bonus int,
  p_monthly_cap int, p_tz text
) returns table (
  referrer_card_id uuid, referred_card_id uuid, referrer_paid boolean, friend_paid boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref      referrals;
  v_count    int;
  v_ref_paid boolean := false;
  v_fr_paid  boolean := false;
begin
  select * into v_ref from referrals where id = p_referral_id and status = 'pending' for update;
  if not found then
    return;
  end if;

  -- Serialize concurrent payouts to the same referrer so the cap holds.
  perform 1 from cards where id = v_ref.referrer_card_id for update;

  select count(*) into v_count
    from referrals r
   where r.referrer_card_id = v_ref.referrer_card_id
     and r.referrer_paid
     and r.rewarded_at >= (date_trunc('month', now() at time zone p_tz)) at time zone p_tz;

  if p_referrer_bonus > 0 and v_count < p_monthly_cap then
    perform grant_card_bonus(v_ref.referrer_card_id, p_referrer_bonus);
    v_ref_paid := true;
  end if;
  if p_friend_bonus > 0 then
    perform grant_card_bonus(v_ref.referred_card_id, p_friend_bonus);
    v_fr_paid := true;
  end if;

  update referrals
     set status = 'rewarded', rewarded_at = now(), referrer_paid = v_ref_paid
   where id = p_referral_id;

  return query select v_ref.referrer_card_id, v_ref.referred_card_id, v_ref_paid, v_fr_paid;
end;
$$;
revoke all on function pay_referral(uuid, int, int, int, text) from public, anon, authenticated;
grant execute on function pay_referral(uuid, int, int, int, text) to service_role;
