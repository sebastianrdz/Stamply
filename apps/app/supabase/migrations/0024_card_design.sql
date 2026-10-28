-- Per-card design: programs.design (jsonb, added in 0001 and unused) now holds
-- the look of each card. Backfilled from the owning business's branding so every
-- existing card renders identically. The business columns are KEPT for one
-- release (code falls back to them via cardDesign()) so rollback is cheap;
-- drop them in a later migration once wallet output is verified.
--
-- Rollback: `update programs set design = '{}'` (cardDesign() then reads the
-- business columns again); no schema change to undo except the policy below.

update programs p
set design = jsonb_build_object(
  'primary_color', b.brand_primary_color,
  'secondary_color', b.brand_secondary_color,
  'logo_url', b.logo_url,
  'background_image_url', b.background_image_url,
  'stamp_icon_url', b.stamp_icon_url,
  'show_business_name', b.show_business_name
)
from businesses b
where b.id = p.business_id;

-- Members can list their own folder in the asset library (0003 only granted
-- insert/update/delete; the bucket is public for GET by URL, but .list() goes
-- through storage.objects RLS).
create policy "business_assets_select" on storage.objects
  for select to authenticated
  using (
    -- CASE guards the uuid cast: other buckets' folder names may not be uuids.
    case when bucket_id = 'business-assets'
      then (storage.foldername(name))[1]::uuid in (select public.auth_business_ids())
      else false
    end
  );
