-- Standalone (non-program) rewards, starting with a business-configured
-- "birthday reward". A reward_definitions row is the business's config for
-- one reward type; standalone_reward_grants tracks a specific customer's
-- earned-but-not-yet-redeemed (or already redeemed) instance of that reward
-- for a given period (e.g. one birthday grant per customer per year).
--
-- Unlike programs/cards (dashboard-writable via RLS), grants are only ever
-- created/updated by trusted server code (the birthday cron + the
-- redeem_standalone_reward RPC below, both service-role), so
-- standalone_reward_grants gets a SELECT-only RLS policy for dashboard
-- reads -- no insert/update/delete policy is defined here, intentionally.

alter table customers add column birthday date;

create table reward_definitions (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses (id) on delete cascade,
  type               text not null check (type in ('birthday')),
  reward_description text not null,
  active             boolean not null default true,
  config             jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (business_id, type)
);
create index on reward_definitions (business_id);
alter table reward_definitions enable row level security;
create policy reward_definitions_all on reward_definitions for all
  using (business_id in (select auth_business_ids()))
  with check (business_id in (select auth_business_ids()));

create trigger reward_definitions_updated_at before update on reward_definitions
  for each row execute function set_updated_at();

create type standalone_reward_status as enum ('available', 'redeemed', 'expired');

-- period_key scopes uniqueness of a grant per recurrence (e.g. 'YYYY' for an
-- annual birthday reward), so a customer can't be granted the same reward
-- twice in the same period, while still allowing a new grant next period.
create table standalone_reward_grants (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references businesses (id) on delete cascade,
  customer_id          uuid not null references customers (id) on delete cascade,
  reward_definition_id uuid not null references reward_definitions (id) on delete cascade,
  period_key           text not null,
  status               standalone_reward_status not null default 'available',
  granted_at           timestamptz not null default now(),
  redeemed_at          timestamptz,
  redeemed_by          uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (customer_id, reward_definition_id, period_key)
);
create index on standalone_reward_grants (business_id);
create index on standalone_reward_grants (customer_id);
create index on standalone_reward_grants (reward_definition_id);
alter table standalone_reward_grants enable row level security;
-- Select-only: inserts/updates happen exclusively via the service-role
-- client and the redeem_standalone_reward SECURITY DEFINER RPC (0018),
-- never from the dashboard session client. Intentional -- do not add
-- insert/update/delete policies here without also reconsidering that RPC.
create policy standalone_reward_grants_select on standalone_reward_grants for select
  using (business_id in (select auth_business_ids()));

-- Speeds up the daily "who's in their birthday month" scan
-- (customers_with_birthday_this_month, 0018), which filters by business and
-- by month-of-birthday. Matches the exact expression the cron function
-- evaluates so the planner can use it.
create index customers_birthday_month_idx on customers (business_id, extract(month from birthday));
