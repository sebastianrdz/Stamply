-- Backfill memberships.email for rows predating 0005.
--
-- 0005_invitations.sql added memberships.email as a denormalized copy of the
-- member's auth.users email, so the Team list can render addresses without an
-- auth.users lookup per row. The column is nullable and was never backfilled,
-- and app code only sets it on inserts made after 0005 (createBusiness for the
-- owner, acceptInvitation for invited members). As a result, any membership
-- created before 0005 — notably early owner rows — has email = null, which the
-- Team page renders as "Unknown email".
--
-- This one-shot backfill copies the address from auth.users for every row still
-- missing one. It only touches rows where email is null, so it is idempotent
-- and safe to re-run. New rows continue to be populated by app code on insert,
-- so no trigger is needed to keep the column in sync going forward.

update memberships as m
   set email = u.email
  from auth.users as u
 where m.user_id = u.id
   and m.email is null
   and u.email is not null;
