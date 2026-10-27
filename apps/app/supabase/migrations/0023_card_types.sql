-- Per-type state for coupon / membership / tiered-points programs.
-- Non-accumulating types (coupon, membership) keep programs.goal = 1.

alter table programs add column config jsonb not null default '{}';

alter table cards
  add column points_redeemed int not null default 0,
  add column uses_count int not null default 0,
  add column expires_at timestamptz,
  add column tier text,
  add column valid_until timestamptz;

alter table stamp_events add column amount_cents int;

-- Legacy points cards banked one reward per `goal` points via cards.rewards;
-- keep their available balance (points - points_redeemed) unchanged.
update cards c
set points_redeemed = greatest(0, (floor(c.points::numeric / p.goal) - c.rewards)::int * p.goal)
from programs p
where p.id = c.program_id and p.type = 'points';

-- Redeem a points tier: spends tier.points from the available balance.
create or replace function redeem_points_tier(
  p_card_id uuid, p_employee_id uuid, p_tier_index int, p_location_id uuid default null
) returns cards language plpgsql security definer set search_path = public as $$
declare
  v_card cards; v_program programs; v_tier jsonb; v_cost int;
begin
  select * into v_card from cards where id = p_card_id for update;
  if not found then raise exception 'card_not_found'; end if;
  select * into v_program from programs where id = v_card.program_id;
  v_tier := v_program.config -> 'tiers' -> p_tier_index;
  if v_tier is null then raise exception 'tier_not_found'; end if;
  v_cost := (v_tier ->> 'points')::int;
  if v_card.points - v_card.points_redeemed < v_cost then
    raise exception 'insufficient_points';
  end if;

  insert into redemptions (business_id, card_id, reward, redeemed_by)
  values (v_card.business_id, p_card_id, v_tier ->> 'reward', p_employee_id);
  insert into stamp_events (business_id, card_id, employee_id, delta, kind, location_id)
  values (v_card.business_id, p_card_id, p_employee_id, -v_cost, 'redeem', p_location_id);

  update cards set points_redeemed = points_redeemed + v_cost
  where id = p_card_id returning * into v_card;
  return v_card;
end $$;

-- Use a coupon once. config.max_uses null/absent = unlimited.
create or replace function use_coupon(
  p_card_id uuid, p_employee_id uuid, p_location_id uuid default null
) returns cards language plpgsql security definer set search_path = public as $$
declare
  v_card cards; v_program programs; v_max int;
begin
  select * into v_card from cards where id = p_card_id for update;
  if not found then raise exception 'card_not_found'; end if;
  select * into v_program from programs where id = v_card.program_id;
  v_max := nullif(v_program.config ->> 'max_uses', '')::int;
  if v_card.expires_at is not null and v_card.expires_at < now() then
    raise exception 'coupon_expired';
  end if;
  if v_max is not null and v_card.uses_count >= v_max then
    raise exception 'coupon_exhausted';
  end if;

  insert into redemptions (business_id, card_id, reward, redeemed_by)
  values (v_card.business_id, p_card_id, v_program.reward_description, p_employee_id);
  insert into stamp_events (business_id, card_id, employee_id, delta, kind, location_id)
  values (v_card.business_id, p_card_id, p_employee_id, -1, 'redeem', p_location_id);

  update cards set uses_count = uses_count + 1
  where id = p_card_id returning * into v_card;
  return v_card;
end $$;

-- Membership check-in: requires an unexpired membership.
create or replace function membership_check_in(
  p_card_id uuid, p_employee_id uuid, p_location_id uuid default null
) returns cards language plpgsql security definer set search_path = public as $$
declare v_card cards;
begin
  select * into v_card from cards where id = p_card_id for update;
  if not found then raise exception 'card_not_found'; end if;
  if v_card.valid_until is null or v_card.valid_until < now() then
    raise exception 'membership_inactive';
  end if;
  insert into stamp_events (business_id, card_id, employee_id, delta, kind, location_id)
  values (v_card.business_id, p_card_id, p_employee_id, 0, 'checkin', p_location_id);
  return v_card;
end $$;

-- Activate or renew: extends from the later of now() and the current expiry.
create or replace function renew_membership(
  p_card_id uuid, p_days int, p_tier text default null
) returns cards language plpgsql security definer set search_path = public as $$
declare v_card cards;
begin
  if p_days < 1 then raise exception 'invalid_days'; end if;
  update cards set
    valid_until = greatest(coalesce(valid_until, now()), now()) + make_interval(days => p_days),
    tier = coalesce(p_tier, tier)
  where id = p_card_id returning * into v_card;
  if not found then raise exception 'card_not_found'; end if;
  return v_card;
end $$;

-- Same lockdown as 0008: RLS-bypassing definers are service_role only.
revoke all on function redeem_points_tier(uuid, uuid, int, uuid) from public, anon, authenticated;
grant execute on function redeem_points_tier(uuid, uuid, int, uuid) to service_role;
revoke all on function use_coupon(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function use_coupon(uuid, uuid, uuid) to service_role;
revoke all on function membership_check_in(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function membership_check_in(uuid, uuid, uuid) to service_role;
revoke all on function renew_membership(uuid, int, text) from public, anon, authenticated;
grant execute on function renew_membership(uuid, int, text) to service_role;
