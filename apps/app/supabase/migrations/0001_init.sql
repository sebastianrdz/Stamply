-- Stamply initial schema: multi-tenant loyalty platform.
-- Tenancy: every tenant-owned row carries business_id; RLS restricts access to
-- members of that business. Public/customer + wallet callback paths bypass RLS
-- via the service-role key on the server only.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type membership_role as enum ('owner', 'admin', 'employee');
create type plan_tier as enum ('trial', 'small', 'medium', 'big');
create type subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid'
);
create type program_type as enum ('stamp', 'points');
create type card_status as enum ('active', 'completed', 'redeemed');
create type stamp_kind as enum ('stamp', 'redeem', 'adjust');

-- ---------------------------------------------------------------------------
-- Core tenant tables
-- ---------------------------------------------------------------------------
create table businesses (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  owner_user_id       uuid not null references auth.users (id) on delete restrict,
  plan                plan_tier not null default 'trial',
  subscription_status subscription_status not null default 'trialing',
  stripe_customer_id  text unique,
  brand_primary_color text not null default '#7C5CFC',
  brand_secondary_color text not null default '#F7A63B',
  logo_url            text,
  timezone            text not null default 'UTC',
  created_at          timestamptz not null default now()
);

create table memberships (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        membership_role not null default 'employee',
  created_at  timestamptz not null default now(),
  unique (business_id, user_id)
);
create index on memberships (user_id);
create index on memberships (business_id);

create table locations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name        text not null,
  address     text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);
create index on locations (business_id);

create table programs (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses (id) on delete cascade,
  name               text not null,
  type               program_type not null default 'stamp',
  goal               integer not null check (goal > 0),
  reward_description text not null,
  active             boolean not null default true,
  design             jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);
create index on programs (business_id);

create table customers (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses (id) on delete cascade,
  full_name          text,
  email              text,
  phone              text,
  marketing_consent  boolean not null default false,
  consent_at         timestamptz,
  source_location_id uuid references locations (id) on delete set null,
  extra              jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);
create index on customers (business_id);
create unique index customers_business_email_key
  on customers (business_id, lower(email)) where email is not null;

create table cards (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses (id) on delete cascade,
  program_id      uuid not null references programs (id) on delete cascade,
  customer_id     uuid not null references customers (id) on delete cascade,
  stamps          integer not null default 0 check (stamps >= 0),
  points          integer not null default 0 check (points >= 0),
  status          card_status not null default 'active',
  barcode_value   text not null unique,
  pass_auth_token text not null,
  apple_serial    text unique,
  google_object_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on cards (business_id);
create index on cards (program_id);
create index on cards (customer_id);

create table stamp_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  card_id     uuid not null references cards (id) on delete cascade,
  employee_id uuid references auth.users (id) on delete set null,
  delta       integer not null,
  kind        stamp_kind not null default 'stamp',
  location_id uuid references locations (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on stamp_events (business_id);
create index on stamp_events (card_id);
create index on stamp_events (created_at);

create table redemptions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  card_id     uuid not null references cards (id) on delete cascade,
  reward      text not null,
  redeemed_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on redemptions (business_id);

-- Apple PassKit device registrations, for APNs push on pass changes.
create table apple_registrations (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses (id) on delete cascade,
  card_id           uuid not null references cards (id) on delete cascade,
  device_library_id text not null,
  pass_serial       text not null,
  push_token        text not null,
  created_at        timestamptz not null default now(),
  unique (device_library_id, pass_serial)
);
create index on apple_registrations (pass_serial);
create index on apple_registrations (card_id);

-- Stripe subscription mirror (source of truth for entitlements).
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references businesses (id) on delete cascade,
  stripe_subscription_id text unique,
  plan                   plan_tier not null,
  status                 subscription_status not null,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on subscriptions (business_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cards_updated_at before update on cards
  for each row execute function set_updated_at();
create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helper + RLS
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER avoids recursive RLS evaluation when policies reference
-- memberships. Returns businesses the current auth user belongs to.
create or replace function auth_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from memberships where user_id = auth.uid();
$$;

create or replace function is_business_admin(b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where business_id = b and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

alter table businesses          enable row level security;
alter table memberships         enable row level security;
alter table locations           enable row level security;
alter table programs            enable row level security;
alter table customers           enable row level security;
alter table cards               enable row level security;
alter table stamp_events        enable row level security;
alter table redemptions         enable row level security;
alter table apple_registrations enable row level security;
alter table subscriptions       enable row level security;

-- businesses: members can read; admins/owners can update; any authed user can
-- create a business (they become owner via the app, membership added server-side).
create policy businesses_select on businesses for select
  using (id in (select auth_business_ids()));
create policy businesses_insert on businesses for insert
  with check (owner_user_id = auth.uid());
create policy businesses_update on businesses for update
  using (is_business_admin(id)) with check (is_business_admin(id));

-- memberships: members can see their business's memberships; admins manage.
create policy memberships_select on memberships for select
  using (business_id in (select auth_business_ids()));
create policy memberships_insert on memberships for insert
  with check (is_business_admin(business_id));
create policy memberships_update on memberships for update
  using (is_business_admin(business_id)) with check (is_business_admin(business_id));
create policy memberships_delete on memberships for delete
  using (is_business_admin(business_id));

-- Generic tenant tables: members read/write rows for their businesses.
-- (Writes that must enforce tier limits or touch customer PII go through
-- server routes with the service-role key; these policies cover dashboard use.)
create policy locations_all on locations for all
  using (business_id in (select auth_business_ids()))
  with check (business_id in (select auth_business_ids()));

create policy programs_all on programs for all
  using (business_id in (select auth_business_ids()))
  with check (business_id in (select auth_business_ids()));

create policy customers_all on customers for all
  using (business_id in (select auth_business_ids()))
  with check (business_id in (select auth_business_ids()));

create policy cards_all on cards for all
  using (business_id in (select auth_business_ids()))
  with check (business_id in (select auth_business_ids()));

create policy stamp_events_all on stamp_events for all
  using (business_id in (select auth_business_ids()))
  with check (business_id in (select auth_business_ids()));

create policy redemptions_all on redemptions for all
  using (business_id in (select auth_business_ids()))
  with check (business_id in (select auth_business_ids()));

create policy apple_registrations_select on apple_registrations for select
  using (business_id in (select auth_business_ids()));

create policy subscriptions_select on subscriptions for select
  using (business_id in (select auth_business_ids()));
