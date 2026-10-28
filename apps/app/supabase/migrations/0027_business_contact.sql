-- Customer-facing contact info + default language for a business.
alter table public.businesses
  add column support_email text check (support_email is null or length(support_email) <= 254),
  add column support_phone text check (support_phone is null or length(support_phone) <= 32),
  add column locale text check (locale is null or locale in ('es', 'en'));
