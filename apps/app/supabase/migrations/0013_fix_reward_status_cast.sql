-- Fix apply_stamp / redeem_card: cast the status CASE expression to card_status.
--
-- Regression of the same bug 0010 fixed for the pre-accumulation apply_stamp.
-- 0012 rewrote both functions to derive status from the rewards counter via
-- `case when v_rewards > 0 then 'completed' else 'active' end`. A CASE whose
-- branches are all untyped string literals resolves to `text`, and there is no
-- implicit text -> enum cast, so the UPDATE failed at runtime with:
--   column "status" is of type card_status but expression is of type text
-- (surfaces on the first real scan; the test suite mocks Supabase and never
-- executes the RPC). Unlike 0010, redeem_card also regressed here because it
-- now uses a CASE too (its old bare `'active'` literal did coerce).
--
-- Recreating both functions with `(...)::card_status`. Bodies are otherwise
-- identical to 0012. CREATE OR REPLACE preserves the ACL, but we re-assert the
-- service_role-only grants from 0008 so this migration is self-contained.

create or replace function apply_stamp(
  p_card_id     uuid,
  p_employee_id uuid,
  p_delta       integer default 1,
  p_location_id uuid default null
)
returns cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card    cards;
  v_program programs;
  v_old     integer;
  v_new     integer;
  v_earned  integer;
  v_rewards integer;
begin
  select * into v_card from cards where id = p_card_id for update;
  if not found then
    raise exception 'card_not_found';
  end if;

  select * into v_program from programs where id = v_card.program_id;

  if v_program.type = 'points' then
    v_old := v_card.points;
  else
    v_old := v_card.stamps;
  end if;

  v_new := greatest(v_old + p_delta, 0);

  v_earned  := (v_new / v_program.goal) - (v_old / v_program.goal);
  v_rewards := greatest(v_card.rewards + v_earned, 0);

  if v_program.type = 'points' then
    update cards set points = v_new, rewards = v_rewards,
      status = (case when v_rewards > 0 then 'completed' else 'active' end)::card_status
      where id = p_card_id returning * into v_card;
  else
    update cards set stamps = v_new, rewards = v_rewards,
      status = (case when v_rewards > 0 then 'completed' else 'active' end)::card_status
      where id = p_card_id returning * into v_card;
  end if;

  insert into stamp_events (business_id, card_id, employee_id, delta, kind, location_id)
  values (v_card.business_id, p_card_id, p_employee_id, p_delta, 'stamp', p_location_id);

  return v_card;
end;
$$;

create or replace function redeem_card(
  p_card_id     uuid,
  p_employee_id uuid,
  p_location_id uuid default null
)
returns cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card    cards;
  v_program programs;
  v_rewards integer;
begin
  select * into v_card from cards where id = p_card_id for update;
  if not found then
    raise exception 'card_not_found';
  end if;
  if v_card.rewards < 1 then
    raise exception 'card_not_redeemable';
  end if;

  select * into v_program from programs where id = v_card.program_id;

  insert into redemptions (business_id, card_id, reward, redeemed_by)
  values (v_card.business_id, p_card_id, v_program.reward_description, p_employee_id);

  insert into stamp_events (business_id, card_id, employee_id, delta, kind, location_id)
  values (v_card.business_id, p_card_id, p_employee_id, -v_program.goal, 'redeem', p_location_id);

  v_rewards := v_card.rewards - 1;
  update cards set rewards = v_rewards,
    status = (case when v_rewards > 0 then 'completed' else 'active' end)::card_status
    where id = p_card_id returning * into v_card;

  return v_card;
end;
$$;

-- Re-assert the lockdown from 0008 (PUBLIC gets EXECUTE by default on create).
revoke all on function apply_stamp(uuid, uuid, integer, uuid) from public;
grant execute on function apply_stamp(uuid, uuid, integer, uuid) to service_role;
revoke all on function redeem_card(uuid, uuid, uuid) from public;
grant execute on function redeem_card(uuid, uuid, uuid) to service_role;
