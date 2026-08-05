-- Fix apply_stamp: cast the status CASE expression to the card_status enum.
--
-- cards.status is the enum type card_status ('active','completed','redeemed').
-- apply_stamp set it from `case when ... then 'completed' else 'active' end`.
-- In Postgres, a CASE whose branches are all untyped string literals resolves
-- to `text` (not `unknown`), and there is no implicit text -> enum cast, so the
-- UPDATE failed at runtime with:
--   column "status" is of type card_status but expression is of type text
--
-- This never surfaced in tests (the suite mocks Supabase and never executes the
-- RPC), so the first real scan/stamp hit it. The bare-literal assignment in
-- redeem_card (`status = 'active'`) is unaffected — a lone unknown literal does
-- coerce to the target enum — so only stamping was broken.
--
-- Recreating the function with `(...)::card_status` fixes both the points and
-- stamps branches. Body is otherwise identical to 0002_stamp_functions.sql.
-- CREATE OR REPLACE preserves the existing ACL, but we re-assert the
-- service_role-only grant from 0008 so this migration is self-contained.

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
      status = (case when v_new >= v_program.goal then 'completed' else 'active' end)::card_status
      where id = p_card_id returning * into v_card;
  else
    v_new := greatest(v_card.stamps + p_delta, 0);
    update cards set stamps = v_new,
      status = (case when v_new >= v_program.goal then 'completed' else 'active' end)::card_status
      where id = p_card_id returning * into v_card;
  end if;

  insert into stamp_events (business_id, card_id, employee_id, delta, kind, location_id)
  values (v_card.business_id, p_card_id, p_employee_id, p_delta, 'stamp', p_location_id);

  return v_card;
end;
$$;

-- Re-assert the lockdown from 0008 (PUBLIC gets EXECUTE by default on create).
revoke all on function apply_stamp(uuid, uuid, integer, uuid) from public;
grant execute on function apply_stamp(uuid, uuid, integer, uuid) to service_role;
