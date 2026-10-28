-- Read-only activity feed: one row per business event, unioned from the
-- tables that already record them. security_invoker makes the underlying
-- tables' RLS (auth_business_ids()) apply to the caller, so a session only
-- sees its own business. Extend by appending another `union all` branch
-- (e.g. automation_runs) with the same column list.
-- `redemptions` is deliberately omitted: redeems are recorded as
-- stamp_events kind 'redeem', and nothing writes the redemptions table.
create view activity_feed with (security_invoker = true) as
  select 'customer_joined:' || c.id as id,
         c.business_id, 'customer_joined'::text as type, c.created_at as occurred_at,
         c.id as customer_id, c.full_name as customer_name,
         null::uuid as card_id, null::text as program_name,
         c.source_location_id as location_id, null::integer as delta, null::text as detail
    from customers c
  union all
  select 'card_issued:' || k.id,
         k.business_id, 'card_issued', k.created_at,
         k.customer_id, c.full_name, k.id, p.name, null, null, null
    from cards k
    join customers c on c.id = k.customer_id
    join programs p on p.id = k.program_id
  union all
  select 'stamp_event:' || e.id,
         e.business_id, e.kind::text, e.created_at,
         k.customer_id, c.full_name, e.card_id, p.name, e.location_id, e.delta, null
    from stamp_events e
    join cards k on k.id = e.card_id
    join customers c on c.id = k.customer_id
    join programs p on p.id = k.program_id
  union all
  select 'reward_granted:' || g.id,
         g.business_id, 'reward_granted', g.granted_at,
         g.customer_id, c.full_name, null, null, null, null, d.reward_description
    from standalone_reward_grants g
    join customers c on c.id = g.customer_id
    join reward_definitions d on d.id = g.reward_definition_id
  union all
  select 'reward_redeemed:' || g.id,
         g.business_id, 'reward_redeemed', g.redeemed_at,
         g.customer_id, c.full_name, null, null, null, null, d.reward_description
    from standalone_reward_grants g
    join customers c on c.id = g.customer_id
    join reward_definitions d on d.id = g.reward_definition_id
   where g.redeemed_at is not null
  union all
  select 'broadcast:' || o.id,
         o.business_id, 'broadcast', o.created_at,
         o.customer_id, c.full_name, null, null, null, null, o.body
    from wallet_offers o
    left join customers c on c.id = o.customer_id;

grant select on activity_feed to authenticated;
