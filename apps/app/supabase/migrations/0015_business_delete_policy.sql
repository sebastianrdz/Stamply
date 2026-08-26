-- businesses currently has select/insert/update policies (0001_init.sql) but no
-- delete policy, so RLS silently blocks every delete attempt. The delete-business
-- feature (src/lib/businesses/delete-actions.ts) goes through createAdminClient()
-- (service-role, bypasses RLS) after an app-layer requireRole(["owner"]) gate, so
-- this policy isn't the primary enforcement -- it's defense-in-depth, mirroring
-- the owner/admin reasoning already applied to businesses_insert/businesses_update:
-- if a delete ever runs on the anon/authenticated role instead of service-role,
-- RLS should still confine it to the business's own owner.
--
-- All tenant tables (memberships, locations, programs, customers, cards,
-- stamp_events, redemptions, apple_registrations, subscriptions, invitations)
-- reference business_id -> businesses(id) on delete cascade, so deleting a row
-- here cascades through the whole tenant and no child-table delete policies are
-- needed for this feature.
create policy businesses_delete on businesses for delete
  using (owner_user_id = auth.uid());
