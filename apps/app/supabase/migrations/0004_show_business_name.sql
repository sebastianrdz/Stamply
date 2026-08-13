-- Lets a business hide its name on wallet passes (some brands prefer the logo
-- alone). Defaults to true to preserve existing pass appearance.
alter table businesses
  add column show_business_name boolean not null default true;
