-- Load measurements against the seeded throwaway database (see README.md).
-- Run with: psql -U supabase_admin -d postgres -f measure.sql
\set ON_ERROR_STOP on
\pset footer off
\set prog '00000000-0000-0000-0000-0000000000c1'

create schema if not exists load;
create table if not exists load.lat (kind text, sess text, ms numeric);
create table if not exists load.claimlog (offer uuid, sess text, customer_id uuid);
create table if not exists load.timing (label text, ms numeric);

-- Simulates the worker: claim a batch, mark it delivered one row at a time
-- (the worker updates per customer), commit per batch.
create or replace procedure load.drain_offer(p_offer uuid, p_sess text, p_batch int default 200, p_log boolean default false)
language plpgsql as $$
declare t0 timestamptz; ids uuid[]; id uuid;
begin
  loop
    t0 := clock_timestamp();
    select array_agg(customer_id) into ids from claim_offer_recipients(p_offer, p_batch, 120);
    insert into load.lat values ('claim_offer', p_sess, extract(epoch from clock_timestamp() - t0) * 1000);
    exit when ids is null;
    if p_log then insert into load.claimlog select p_offer, p_sess, unnest(ids); end if;
    t0 := clock_timestamp();
    foreach id in array ids loop
      update wallet_offer_recipients set delivered_at = clock_timestamp()
       where offer_id = p_offer and customer_id = id;
    end loop;
    insert into load.lat values ('mark_row', p_sess, extract(epoch from clock_timestamp() - t0) * 1000 / array_length(ids, 1));
    commit;
  end loop;
end $$;

-- Claim a batch of cards, delete their queue rows, commit per batch.
create or replace procedure load.drain_refresh(p_batch int default 50)
language plpgsql as $$
declare t0 timestamptz; ids uuid[];
begin
  loop
    t0 := clock_timestamp();
    select array_agg(card_id) into ids from claim_wallet_refresh(p_batch, 300);
    insert into load.lat values ('claim_refresh', 'main', extract(epoch from clock_timestamp() - t0) * 1000);
    exit when ids is null;
    t0 := clock_timestamp();
    delete from wallet_refresh_queue where card_id = any(ids);
    insert into load.lat values ('delete_refresh', 'main', extract(epoch from clock_timestamp() - t0) * 1000);
    commit;
  end loop;
end $$;

create or replace function load.new_offer(p_label text) returns uuid
language plpgsql as $$
declare t0 timestamptz := clock_timestamp(); v uuid;
begin
  insert into wallet_offers (business_id, body, delivery)
    values ('00000000-0000-0000-0000-0000000000b1', 'load', 'pending') returning id into v;
  insert into load.timing values (p_label, extract(epoch from clock_timestamp() - t0) * 1000);
  return v;
end $$;

\echo '== 1. create pending broadcast (trigger fills recipients), 3 samples'
select load.new_offer('offer_create_25k') as o1 \gset
select load.new_offer('offer_create_25k') as o_spare1 \gset
select load.new_offer('offer_create_25k') as o_spare2 \gset
select label, round(ms) ms from load.timing where label = 'offer_create_25k';
select count(*) recipients from wallet_offer_recipients where offer_id = :'o1';
analyze wallet_offer_recipients;

\echo '== 2a. EXPLAIN claim with 25,000 undelivered'
begin;
explain (analyze, buffers, costs off)
  with picked as (
    select r.offer_id, r.customer_id from wallet_offer_recipients r
     where r.offer_id = :'o1' and r.delivered_at is null and r.attempts < 3
       and (r.claimed_until is null or r.claimed_until < now())
     order by r.customer_id limit 200 for update skip locked)
  update wallet_offer_recipients r set claimed_until = now() + interval '120 s', attempts = r.attempts + 1
    from picked where r.offer_id = picked.offer_id and r.customer_id = picked.customer_id;
rollback;

\echo '== 2b. drain offer 1 to empty (200/claim, per-row mark, commit per batch)'
truncate load.lat;
select clock_timestamp() as t0 \gset
call load.drain_offer(:'o1', 'solo');
select round(extract(epoch from clock_timestamp() - :'t0'::timestamptz)::numeric, 2) as drain_seconds,
       (select count(*) from wallet_offer_recipients where offer_id = :'o1' and delivered_at is null) as left_undelivered;
select kind, count(*) n,
       round(percentile_cont(0.5) within group (order by ms)::numeric, 2) p50_ms,
       round(percentile_cont(0.95) within group (order by ms)::numeric, 2) p95_ms,
       round(max(ms)::numeric, 2) max_ms
  from load.lat group by kind order by kind;

\echo '== 2c. worst case: 24,000 of 25,000 already delivered, claim the last 1,000'
select :'o_spare1' as o \gset
update wallet_offer_recipients set delivered_at = now()
 where offer_id = :'o_spare1'
   and customer_id in (select customer_id from wallet_offer_recipients
                        where offer_id = :'o_spare1' order by customer_id limit 24000);
analyze wallet_offer_recipients;
begin;
explain (analyze, buffers, costs off)
  with picked as (
    select r.offer_id, r.customer_id from wallet_offer_recipients r
     where r.offer_id = :'o_spare1' and r.delivered_at is null and r.attempts < 3
       and (r.claimed_until is null or r.claimed_until < now())
     order by r.customer_id limit 200 for update skip locked)
  update wallet_offer_recipients r set claimed_until = now() + interval '120 s', attempts = r.attempts + 1
    from picked where r.offer_id = picked.offer_id and r.customer_id = picked.customer_id;
rollback;

\echo '== 3. concurrency: run concurrency.sh separately (needs two sessions)'

\echo '== 4. program-wide refresh queue, 25,000 cards'
select clock_timestamp() as t0 \gset
select request_program_wallet_refresh(:'prog') as queued \gset
select :'queued' queued, round(extract(epoch from clock_timestamp() - :'t0'::timestamptz)::numeric * 1000) request_ms;
select clock_timestamp() as t0 \gset
select request_program_wallet_refresh(:'prog') as requeued \gset
select :'requeued' requeued_while_rows_exist, round(extract(epoch from clock_timestamp() - :'t0'::timestamptz)::numeric * 1000) rerequest_ms;
analyze wallet_refresh_queue;
begin;
explain (analyze, buffers, costs off)
  with picked as (
    select q.card_id from wallet_refresh_queue q
     where q.attempts < 3 and (q.claimed_until is null or q.claimed_until < now())
     order by q.requested_at, q.card_id limit 50 for update skip locked)
  update wallet_refresh_queue q set claimed_until = now() + interval '300 s', attempts = q.attempts + 1
    from picked where q.card_id = picked.card_id;
rollback;

\echo '== 5. status functions with 25,000 rows each (o_spare2 is fully pending)'
do $$
declare t0 timestamptz; i int; o uuid;
begin
  select id into o from wallet_offers where delivery = 'pending' order by created_at desc limit 1;
  for i in 1..10 loop
    t0 := clock_timestamp(); perform * from offer_delivery_status(o);
    insert into load.timing values ('offer_delivery_status', extract(epoch from clock_timestamp() - t0) * 1000);
    t0 := clock_timestamp(); perform * from wallet_refresh_status('00000000-0000-0000-0000-0000000000c1');
    insert into load.timing values ('wallet_refresh_status', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;
select label, round(avg(ms)::numeric, 1) avg_ms, round(max(ms)::numeric, 1) max_ms
  from load.timing where label like '%status' group by label;

\echo '== 4b. drain the refresh queue (50/claim, delete per batch)'
truncate load.lat;
select clock_timestamp() as t0 \gset
call load.drain_refresh(50);
select round(extract(epoch from clock_timestamp() - :'t0'::timestamptz)::numeric, 2) as drain_seconds,
       (select count(*) from wallet_refresh_queue) as rows_left;
select kind, count(*) n,
       round(percentile_cont(0.5) within group (order by ms)::numeric, 2) p50_ms,
       round(percentile_cont(0.95) within group (order by ms)::numeric, 2) p95_ms,
       round(max(ms)::numeric, 2) max_ms
  from load.lat group by kind order by kind;

\echo '== 6. sizes (offer 1 fully delivered, offers 2-3 partly; 75,000 recipient rows)'
select relname, pg_size_pretty(pg_total_relation_size(oid)) total, pg_size_pretty(pg_relation_size(oid)) heap
  from pg_class where relname in ('wallet_offer_recipients', 'wallet_refresh_queue', 'cards', 'customers', 'apple_registrations') order by relname;
select indexrelid::regclass index, pg_size_pretty(pg_relation_size(indexrelid)) size
  from pg_index where indrelid in ('wallet_offer_recipients'::regclass, 'wallet_refresh_queue'::regclass) order by 1::text;
