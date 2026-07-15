-- Atomic stamping / redemption. Called server-side (service role) from the scan
-- flow so the increment, completion transition, and audit event are one unit.

-- Add stamps (or points) to a card, log the event, and flip to 'completed' when
-- the program goal is reached. Returns the updated card row.
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
  v_new     integer;
begin
  select * into v_card from cards where id = p_card_id for update;
  if not found then
    raise exception 'card_not_found';
  end if;

  select * into v_program from programs where id = v_card.program_id;

  if v_program.type = 'points' then
    v_new := greatest(v_card.points + p_delta, 0);
    update cards set points = v_new,
      status = case when v_new >= v_program.goal then 'completed' else 'active' end
      where id = p_card_id returning * into v_card;
  else
    v_new := greatest(v_card.stamps + p_delta, 0);
    update cards set stamps = v_new,
      status = case when v_new >= v_program.goal then 'completed' else 'active' end
      where id = p_card_id returning * into v_card;
  end if;

  insert into stamp_events (business_id, card_id, employee_id, delta, kind, location_id)
  values (v_card.business_id, p_card_id, p_employee_id, p_delta, 'stamp', p_location_id);

  return v_card;
end;
$$;

-- Redeem a completed card: reset progress, log redemption + event, set status.
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
begin
  select * into v_card from cards where id = p_card_id for update;
  if not found then
    raise exception 'card_not_found';
  end if;
  if v_card.status <> 'completed' then
    raise exception 'card_not_redeemable';
  end if;

  select * into v_program from programs where id = v_card.program_id;

  insert into redemptions (business_id, card_id, reward, redeemed_by)
  values (v_card.business_id, p_card_id, v_program.reward_description, p_employee_id);

  insert into stamp_events (business_id, card_id, employee_id, delta, kind, location_id)
  values (v_card.business_id, p_card_id, p_employee_id,
          case when v_program.type = 'points' then -v_card.points else -v_card.stamps end,
          'redeem', p_location_id);

  update cards set stamps = 0, points = 0, status = 'active'
    where id = p_card_id returning * into v_card;

  return v_card;
end;
$$;
