-- System wallet messages (D3): "your friend joined, you earned a bonus" is sent
-- to the referrer as a wallet message (the only thing that shows a lock-screen
-- notification), but it is not an owner broadcast. `kind` keeps it out of the
-- Broadcast history/activity feed and out of visit attribution.
alter table wallet_offers
  add column kind text not null default 'offer' check (kind in ('offer', 'referral'));

-- Messages that count for visit attribution: owner offers and automations,
-- excluding review invites (0031) and system messages.
create or replace view attribution_recipients with (security_invoker = true) as
  select r.*
    from wallet_offer_recipients r
   where not exists (
     select 1
       from wallet_offers o
       left join reward_definitions d on d.id = o.automation_id
      where o.id = r.offer_id
        and (o.kind <> 'offer' or d.type = 'review_prompt')
   );

-- activity_feed (0026) with the broadcast branch limited to owner offers.
create or replace view activity_feed with (security_invoker = true) as
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
    left join customers c on c.id = o.customer_id
   where o.automation_id is null and o.kind = 'offer'
  union all
  select 'automation_sent:' || r.id,
         r.business_id, 'automation_sent', r.sent_at,
         r.customer_id, c.full_name, null, null, null, null, d.type
    from automation_runs r
    join customers c on c.id = r.customer_id
    join reward_definitions d on d.id = r.automation_id;

grant select on activity_feed to authenticated;
