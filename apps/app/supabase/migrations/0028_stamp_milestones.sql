-- Stamp milestones: extra rewards at chosen stamps (programs.config.milestones,
-- [{ at, reward, icon_url }], at < goal). Earned from the lifetime stamp total,
-- so nothing changes in apply_stamp; only redemptions are recorded, per `at`.

alter table cards add column milestones_redeemed jsonb not null default '{}';

create or replace function redeem_stamp_milestone(
  p_card_id uuid, p_employee_id uuid, p_at int, p_location_id uuid default null
) returns cards language plpgsql security definer set search_path = public as $$
declare
  v_card cards; v_program programs; v_ms jsonb; v_earned int; v_done int;
begin
  select * into v_card from cards where id = p_card_id for update;
  if not found then raise exception 'card_not_found'; end if;
  select * into v_program from programs where id = v_card.program_id;
  if v_program.type <> 'stamp' then raise exception 'milestone_not_found'; end if;

  select m into v_ms
  from jsonb_array_elements(coalesce(v_program.config -> 'milestones', '[]'::jsonb)) m
  where (m ->> 'at')::int = p_at and (m ->> 'at')::int < v_program.goal
  limit 1;
  if v_ms is null then raise exception 'milestone_not_found'; end if;

  -- Reached once per cycle: at, at + goal, at + 2*goal, ...
  v_earned := case when v_card.stamps >= p_at
                   then (v_card.stamps - p_at) / v_program.goal + 1 else 0 end;
  v_done := coalesce((v_card.milestones_redeemed ->> p_at::text)::int, 0);
  if v_earned - v_done < 1 then raise exception 'card_not_redeemable'; end if;

  insert into redemptions (business_id, card_id, reward, redeemed_by)
  values (v_card.business_id, p_card_id, v_ms ->> 'reward', p_employee_id);
  insert into stamp_events (business_id, card_id, employee_id, delta, kind, location_id)
  values (v_card.business_id, p_card_id, p_employee_id, 0, 'redeem', p_location_id);

  update cards
  set milestones_redeemed = jsonb_set(milestones_redeemed, array[p_at::text], to_jsonb(v_done + 1))
  where id = p_card_id returning * into v_card;
  return v_card;
end $$;

revoke all on function redeem_stamp_milestone(uuid, uuid, int, uuid) from public, anon, authenticated;
grant execute on function redeem_stamp_milestone(uuid, uuid, int, uuid) to service_role;
