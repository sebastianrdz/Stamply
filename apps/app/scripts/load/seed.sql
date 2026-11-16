-- Seeds one business, one program, 25,000 consenting customers and 25,000+
-- cards (every 500th customer has 2 cards; ~60% have an Apple registration).
-- Throwaway DB only. Idempotent only on a fresh database.
\set ON_ERROR_STOP on
\timing on
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'load@example.test');
insert into businesses (id, name, slug, owner_user_id)
  values ('00000000-0000-0000-0000-0000000000b1', 'Load', 'load', '00000000-0000-0000-0000-0000000000aa');
insert into programs (id, business_id, name, goal, reward_description)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'P', 10, 'R');

insert into customers (id, business_id, marketing_consent)
select gen_random_uuid(), '00000000-0000-0000-0000-0000000000b1', true from generate_series(1, 25000);

create temp table seeded as
  select id, row_number() over (order by id) n from customers;

insert into cards (business_id, program_id, customer_id, barcode_value, pass_auth_token, apple_serial, google_object_id)
select '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', s.id,
       'bc-' || s.n || '-' || k, 'tok-' || s.n || '-' || k, 'as-' || s.n || '-' || k, 'go-' || s.n || '-' || k
  from seeded s cross join lateral generate_series(1, case when s.n % 500 = 0 then 2 else 1 end) k;

insert into apple_registrations (business_id, card_id, device_library_id, pass_serial, push_token)
select business_id, id, 'dev-' || row_number() over (), apple_serial, 'push-' || id
  from cards where (hashtext(id::text) % 10) < 6;

analyze;
select (select count(*) from customers) customers, (select count(*) from cards) cards,
       (select count(*) from apple_registrations) apple_regs;
