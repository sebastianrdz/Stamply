-- Stamp icon: uploaded SVG used to render each stamp slot on the loyalty
-- card (in place of the default stamp graphic). Stored the same way as the
-- other branding assets in 0003_business_assets.sql — `stamp_icon_url` holds
-- the public URL of an uploaded object, not the SVG itself.

alter table businesses
  add column stamp_icon_url text;

-- No new storage bucket or RLS policy needed: the `business-assets` bucket
-- and its `{business_id}/` folder policies (0003_business_assets.sql) already
-- cover this upload. Those policies gate writes by folder path only, not by
-- file type/kind, so SVG stamp icons are already permitted alongside the
-- existing logo and background-image uploads.
