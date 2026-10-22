-- Wallet push offers: a message a business sends to its customers' wallet
-- passes. customer_id null = every opted-in customer of the business. The
-- newest matching row is the offer shown on a card's pass, and the table is
-- also the send history.
create table wallet_offers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  customer_id uuid references customers (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 200),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on wallet_offers (business_id, created_at desc);

alter table wallet_offers enable row level security;

-- Members read the history. Inserts go through the sendOffer server action
-- (service role) so the consent filter and rate limit can't be bypassed.
create policy wallet_offers_select on wallet_offers for select
  using (business_id in (select auth_business_ids()));
