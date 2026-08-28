-- Apple's wallet route (app/api/wallet/apple/[token]/route.ts) needs a marker to
-- dedupe the "wallet_pass_generated" analytics event so it only fires the first
-- time a card's Apple pass is actually fetched -- mirroring the pattern already
-- used on the Google side, which gates on `cards.google_object_id` being null
-- and then sets it (see app/api/wallet/google/[token]/route.ts).
--
-- `apple_serial` can't be reused for this: it's set at card-issue time
-- (src/lib/cards/issue.ts), not at first-fetch time, so it's already non-null
-- before any pass has been generated. Apple also has no equivalent "object id"
-- concept assigned at fetch time, so instead of an id we key off a nullable
-- timestamp, set once on first successful pass generation.
--
-- Purely additive: no backfill. Existing rows get null, which is the correct
-- state for them too -- "no Apple pass generated (for analytics purposes) yet".
--
-- To reverse: alter table cards drop column apple_pass_generated_at;
alter table cards
  add column apple_pass_generated_at timestamptz;
