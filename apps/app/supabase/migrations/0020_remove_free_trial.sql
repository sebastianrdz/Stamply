-- Remove the free "trial" plan. A business now has no plan ('none') until its
-- owner subscribes; every plan starts with a 14-day Stripe trial instead.
-- Existing rows on 'trial' become 'none' and are locked until they pick a plan.
alter type plan_tier rename value 'trial' to 'none';

alter table businesses alter column plan set default 'none';
alter table businesses alter column subscription_status set default 'incomplete';

-- 'trialing' now only ever means a real Stripe trial.
update businesses
  set subscription_status = 'incomplete'
  where plan = 'none' and subscription_status = 'trialing';
