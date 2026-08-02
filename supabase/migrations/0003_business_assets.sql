-- Business branding assets: uploaded logo + wallet-pass background image.
-- Both are now stored in Supabase Storage (public bucket) rather than pasted
-- as external URLs. `logo_url` keeps its name but now holds the public URL of
-- an uploaded object; `background_image_url` is new.

alter table businesses
  add column background_image_url text;

-- ---------------------------------------------------------------------------
-- Storage bucket for business assets
-- ---------------------------------------------------------------------------
-- Public read: Apple Wallet fetches the image server-side to embed into the
-- .pkpass, and Google Wallet references the URL directly — both need
-- unauthenticated GET access. Writes are gated by RLS below.
insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', true)
on conflict (id) do nothing;

-- Objects are keyed as `{business_id}/...`. A business's members may write only
-- within their own folder; auth_business_ids() is defined in 0001_init.sql.
create policy "business_assets_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1]::uuid in (select public.auth_business_ids())
  );

create policy "business_assets_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1]::uuid in (select public.auth_business_ids())
  )
  with check (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1]::uuid in (select public.auth_business_ids())
  );

create policy "business_assets_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1]::uuid in (select public.auth_business_ids())
  );
