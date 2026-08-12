-- Accumulating rewards.
--
-- Model change: `cards.stamps` / `cards.points` become LIFETIME cumulative
-- totals that are never reset. A card's displayed progress toward the next
-- reward is the remainder `total % goal`, computed at read time. Each time the
-- running total crosses a multiple of the program goal, one reward is banked
-- into the new `cards.rewards` counter, which accrues (1, 2, 3, ...). Redeeming
-- consumes exactly one banked reward (decrementing `rewards`) WITHOUT touching
-- the lifetime total, so the customer keeps whatever remainder progress they
-- had toward the following reward.

-- ---------------------------------------------------------------------------
-- Schema: banked (earned-but-unredeemed) reward counter.
-- ---------------------------------------------------------------------------
alter table cards
  add column rewards integer not null default 0 check (rewards >= 0);

-- Backfill from existing lifetime progress: a card that had reached its goal
-- (previously flipped to 'completed') has floor(progress / goal) rewards
-- banked. Under the old model redeem reset progress to 0, so in practice this
-- is 0 or 1 for most cards, but floor() handles any overshoot correctly.
update cards c
set rewards = floor(
  (case when p.type = 'points' then c.points else c.stamps end)::numeric
  / p.goal
)::int
from programs p
where p.id = c.program_id;

-- Normalize status to the new invariant (completed iff a reward is banked).
-- Leaves any 'redeemed' rows untouched.
update cards
set status = case when rewards > 0 then 'completed'::card_status
                  else 'active'::card_status end
where status in ('active', 'completed');

-- ---------------------------------------------------------------------------
-- apply_stamp: accumulate lifetime total, bank a reward on each goal crossing.
-- ---------------------------------------------------------------------------
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
  v_earned  integer;  -- change in banked rewards from this delta
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

  -- Lifetime total never goes below 0 (negative deltas are corrections).
  v_new := greatest(v_old + p_delta, 0);

  -- Rewards banked = how many additional goal multiples the new total covers
  -- vs. the old one. Integer division floors for these non-negative values.
  -- A downward correction that crosses a boundary the other way yields a
  -- negative delta; greatest(...,0) keeps the counter within its check.
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

-- ---------------------------------------------------------------------------
-- redeem_card: consume one banked reward. Lifetime total is preserved so the
-- customer keeps their remainder progress toward the next reward.
-- ---------------------------------------------------------------------------
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
  -- Only decrement when a reward is actually available.
  if v_card.rewards < 1 then
    raise exception 'card_not_redeemable';
  end if;

  select * into v_program from programs where id = v_card.program_id;

  insert into redemptions (business_id, card_id, reward, redeemed_by)
  values (v_card.business_id, p_card_id, v_program.reward_description, p_employee_id);

  -- Audit event represents one reward's worth of progress consumed. Stamps/
  -- points are intentionally NOT decremented (the lifetime total is retained).
  insert into stamp_events (business_id, card_id, employee_id, delta, kind, location_id)
  values (v_card.business_id, p_card_id, p_employee_id, -v_program.goal, 'redeem', p_location_id);

  v_rewards := v_card.rewards - 1;
  update cards set rewards = v_rewards,
    status = (case when v_rewards > 0 then 'completed' else 'active' end)::card_status
    where id = p_card_id returning * into v_card;

  return v_card;
end;
$$;
