-- Team invitations: an owner/admin creates a tokenized invite; the invitee
-- accepts via /join/<token>, which creates their membership server-side (via the
-- service-role key, so it can run before they are a member — with the tier limit
-- enforced in app code). Email is also denormalized onto memberships so the Team
-- list can render member emails without auth.users lookups.

alter table memberships
  add column email text;

create table invitations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  email       text not null,
  role        membership_role not null default 'employee',
  token       text not null unique,
  invited_by  uuid references auth.users (id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on invitations (business_id);
create index on invitations (token);

alter table invitations enable row level security;

-- Owners/admins manage their business's invitations. The accept flow reads an
-- invite by token for a not-yet-member user through the service-role key, which
-- bypasses RLS, so no member-facing select policy is needed here.
create policy invitations_select on invitations for select
  using (is_business_admin(business_id));
create policy invitations_insert on invitations for insert
  with check (is_business_admin(business_id));
create policy invitations_update on invitations for update
  using (is_business_admin(business_id)) with check (is_business_admin(business_id));
create policy invitations_delete on invitations for delete
  using (is_business_admin(business_id));
