-- One row per (business, month) whose monthly ROI summary email has been
-- handled. Claim-then-send, like automation_runs: the primary key is the
-- idempotency guard so a second cron run (or an overlap) can't double-send.
-- period_key is the previous local month, 'YYYY-MM'. Rows are written by the
-- cron (service role); a failed send deletes its claim so it can retry.
create table monthly_summaries (
  business_id uuid not null references businesses (id) on delete cascade,
  period_key  text not null check (period_key ~ '^\d{4}-\d{2}$'),
  sent_at     timestamptz not null default now(),
  primary key (business_id, period_key)
);

alter table monthly_summaries enable row level security;
create policy monthly_summaries_select on monthly_summaries for select
  using (business_id in (select auth_business_ids()));
