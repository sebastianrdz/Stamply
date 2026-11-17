# Broadcast scale: load check (PR 6 of 6)

Question: do the delivery queue (migration 0035) and the push worker hold up at the new customer caps (Medium 5,000, Big 25,000)? Two parts: **real SQL timings** on a throwaway Postgres, and a **modeled** worker simulation with _assumed_ latencies. The doc keeps them apart. Nothing here touched a real Supabase project, Apple or Google.

## 1. What was run

- Image `public.ecr.aws/supabase/postgres:17.11.0.018` in a throwaway container (`stamply-load`, stopped afterwards). All migrations applied in order except 0003 and 0024 (they need the `storage` schema, absent in that image).
- `apps/app/scripts/load/`: `seed.sql` (1 business, 1 program, 25,000 consenting customers, 25,050 cards (every 500th customer has 2), 19,931 Apple registrations), `measure.sql`, `concurrency.sh`, `README.md`. Repeatable end to end.
- The worker is simulated in SQL: claim a batch, mark delivered one row at a time (like the worker), commit per batch. This is the database cost only, from inside Postgres. **No PostgREST, no network, no TLS, no cross-region round trip.** A real call from Vercel adds a few to tens of ms per call (not measured).

## 2. Real SQL numbers (one run, one laptop, Postgres in Docker, warm cache)

| What                                                                         | Result                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Create a pending broadcast to 25,000 (trigger fills recipients)           | 499, 442, 439 ms (3 samples); 25,000 rows                                                                                                                                         |
| 2. Drain 25,000 recipients, claim 200 + per-row mark + commit, single worker | 1.64 s total, 125 claims. Claim p50 5.8 ms, p95 9.4 ms, max 9.9 ms. Per-row mark about 0.03 ms                                                                                    |
| 2b. Claim cost with 25,000 undelivered                                       | 3.3 ms (EXPLAIN ANALYZE), 405 buffers                                                                                                                                             |
| 2c. Worst case: 24,000 already delivered, claim the last                     | 11.7 ms, 48,722 buffers (scans and discards 24,000 rows)                                                                                                                          |
| 3. Two sessions draining the same offer                                      | 25,000 claimed, 25,000 distinct, **0 duplicates**; 12,478 / 12,522 per session; 1.16 s wall (vs 1.64 s alone). Claim p95 14.3 ms each                                             |
| 4. `request_program_wallet_refresh` for 25,050 cards                         | 966 ms. Re-request while all rows exist: 818 ms (resets the rows)                                                                                                                 |
| 4b. Drain refresh queue: claim 50 + delete + commit                          | 3.05 s total, 502 claims. Claim p50 5.5 ms, p95 9.7 ms, max 12.9 ms; delete p95 0.17 ms                                                                                           |
| 4c. Refresh claim plan at 25,050 rows                                        | Seq scan + top-N sort, 11.3 ms (all rows qualify, so an index would not help yet)                                                                                                 |
| 5. `offer_delivery_status` / `wallet_refresh_status` at 25,000 rows          | 4.6 ms avg (max 4.9) / 1.9 ms avg (max 2.2)                                                                                                                                       |
| 6. Sizes                                                                     | `wallet_offer_recipients` 23 MB for 75,000 rows (pkey 6.1 MB, business/customer/sent_at idx 7.1 MB, partial `offer_id` idx 0.5 MB); `wallet_refresh_queue` 6.8 MB for 25,050 rows |

### Finding: the claim does not use the partial index

`EXPLAIN` shows `Index Scan using wallet_offer_recipients_pkey` with a filter, not the partial `(offer_id) where delivered_at is null` index. The claim orders by `customer_id`, which the primary key `(offer_id, customer_id)` already provides, so the planner walks the pkey and discards delivered rows. Because delivery goes in `customer_id` order, delivered rows pile up at the front: claim cost grows with the number already delivered (3.3 ms at 0 delivered, 11.7 ms at 24,000). At 25,000 recipients that is still cheap (the whole drain is 1.6 s of DB time), so **no change shipped**. Probe, not shipped: on the same data an index `(offer_id, customer_id) where delivered_at is null` made the claim read about 800 buffers instead of 48,722. Worth adding only if offers grow far beyond 25,000 recipients or claims show up slow in production.

Also noted: the worker marks delivered **one DB call per Google customer** (one `update` each), so a 200-customer batch makes about 200 small calls on top of the Google calls. They run inside the concurrency pool, so cost is bounded, but each is a network round trip in production (see model).

## 3. Worker simulation (MODEL, not measured)

`apps/app/src/lib/wallet/push-worker.load.test.ts`, run with `LOAD=1 pnpm vitest run src/lib/wallet/push-worker.load.test.ts` (skipped otherwise). It drives the real `drainOfferDeliveries` / `drainWalletRefresh` code against the in-memory fake with a virtual clock and injected latency, repeating 48 s invocations ("links") until finished.

**Latencies are assumptions, not measurements:** Google addMessage 250 ms, Google patch for refresh 800 ms (renders and uploads a strip), APNs batch 100 ms, DB call 5 ms (override with `LAT_GOOGLE_MSG_MS`, `LAT_GOOGLE_PATCH_MS`, `LAT_APNS_BATCH_MS`, `LAT_DB_MS`). All Google customers assumed (worst case), Google quota not modeled (no 429s).

Formulas to plug in real numbers:

- passes per second ≈ googleConcurrency / (googleLatency + dbLatency) (Apple and per-batch DB calls add a little)
- finish seconds ≈ n / passes per second; chain links = ceil(finish seconds / 48)
- batch seconds ≈ batchSize / googleConcurrency × (googleLatency + dbLatency). The deadline is only checked **between** batches, so a batch started at 47.9 s must end inside the 60 s `maxDuration`: keep batch seconds under about 12.

### Offers, 25,000 recipients

| googleConcurrency | batchSize | passes/s | finish (min) | 48 s links | batch s | fits 12 s |
| ----------------- | --------- | -------- | ------------ | ---------- | ------- | --------- |
| 5                 | 100       | 19.1     | 21.8         | 26         | 5.1     | yes       |
| 5                 | 200       | 19.4     | 21.5         | 26         | 10.2    | yes       |
| 5                 | 500       | 19.5     | 21.4         | 26         | 25.5    | NO        |
| 10                | 100       | 37.4     | 11.2         | 14         | 2.6     | yes       |
| 10                | 200       | 38.3     | 10.9         | 13         | 5.1     | yes       |
| 10                | 500       | 38.8     | 10.7         | 13         | 12.8    | NO        |
| 20                | 100       | 71.4     | 5.8          | 8          | 1.3     | yes       |
| 20                | 200       | 74.8     | 5.6          | 7          | 2.6     | yes       |
| 20                | 500       | 76.9     | 5.4          | 7          | 6.4     | yes       |
| 40                | 100       | 112.3    | 3.7          | 5          | 0.6     | yes       |
| 40                | 200       | 142.8    | 2.9          | 4          | 1.3     | yes       |
| 40                | 500       | 145.3    | 2.9          | 4          | 3.2     | yes       |

### Offers, 5,000 recipients

| googleConcurrency | batchSize | passes/s | finish (min) | 48 s links | batch s | fits 12 s |
| ----------------- | --------- | -------- | ------------ | ---------- | ------- | --------- |
| 5                 | 100       | 19.1     | 4.3          | 6          | 5.1     | yes       |
| 5                 | 200       | 19.4     | 4.3          | 6          | 10.2    | yes       |
| 5                 | 500       | 19.5     | 4.3          | 6          | 25.5    | NO        |
| 10                | 100       | 37.4     | 2.2          | 3          | 2.6     | yes       |
| 10                | 200       | 38.3     | 2.2          | 3          | 5.1     | yes       |
| 10                | 500       | 38.8     | 2.1          | 3          | 12.8    | NO        |
| 20                | 100       | 71.4     | 1.2          | 2          | 1.3     | yes       |
| 20                | 200       | 74.7     | 1.1          | 2          | 2.6     | yes       |
| 20                | 500       | 76.9     | 1.1          | 2          | 6.4     | yes       |
| 40                | 100       | 112.3    | 0.8          | 1          | 0.6     | yes       |
| 40                | 200       | 142.8    | 0.6          | 1          | 1.3     | yes       |
| 40                | 500       | 145.3    | 0.6          | 1          | 3.2     | yes       |

### Refresh (card design change), 25,000 cards

| googleConcurrency | batchSize | passes/s | finish (min) | 48 s links | batch s | fits 12 s |
| ----------------- | --------- | -------- | ------------ | ---------- | ------- | --------- |
| 5                 | 100       | 6.2      | 67.6         | 84         | 16.1    | NO        |
| 5                 | 200       | 6.2      | 67.3         | 63         | 32.2    | NO        |
| 5                 | 500       | 6.2      | 67.2         | 50         | 80.5    | NO        |
| 10                | 100       | 12.2     | 34.0         | 42         | 8.1     | yes       |
| 10                | 200       | 12.3     | 33.8         | 42         | 16.1    | NO        |
| 10                | 500       | 12.4     | 33.6         | 25         | 40.3    | NO        |
| 20                | 100       | 24.2     | 17.2         | 21         | 4       | yes       |
| 20                | 200       | 24.5     | 17.0         | 21         | 8.1     | yes       |
| 20                | 500       | 24.7     | 16.9         | 17         | 20.1    | NO        |
| 40                | 100       | 39.5     | 10.6         | 14         | 2       | yes       |
| 40                | 200       | 48.3     | 8.6          | 11         | 4       | yes       |
| 40                | 500       | 47.3     | 8.8          | 10         | 10.1    | yes       |

### Refresh, 5,000 cards

| googleConcurrency | batchSize | passes/s | finish (min) | 48 s links | batch s | fits 12 s |
| ----------------- | --------- | -------- | ------------ | ---------- | ------- | --------- |
| 5                 | 100       | 6.2      | 13.5         | 17         | 16.1    | NO        |
| 5                 | 200       | 6.2      | 13.5         | 13         | 32.2    | NO        |
| 5                 | 500       | 6.2      | 13.4         | 10         | 80.5    | NO        |
| 10                | 100       | 12.2     | 6.8          | 9          | 8.1     | yes       |
| 10                | 200       | 12.3     | 6.8          | 9          | 16.1    | NO        |
| 10                | 500       | 12.4     | 6.7          | 5          | 40.3    | NO        |
| 20                | 100       | 24.2     | 3.5          | 5          | 4       | yes       |
| 20                | 200       | 24.5     | 3.4          | 5          | 8.1     | yes       |
| 20                | 500       | 24.7     | 3.4          | 4          | 20.1    | NO        |
| 40                | 100       | 39.5     | 2.1          | 3          | 2       | yes       |
| 40                | 200       | 48.3     | 1.7          | 3          | 4       | yes       |
| 40                | 500       | 47.3     | 1.8          | 2          | 10.1    | yes       |

## 4. Recommendation

Current defaults (unchanged): offers batchSize 200, googleConcurrency 10, leaseSeconds 120; refresh batchSize 50, googleConcurrency 5, leaseSeconds 300.

- **Defaults left unchanged.** The only real numbers are SQL, and they say the database is not the bottleneck (a full 25,000 drain is 1.6 s of DB time). The deciding inputs (Google latency, Google quota) are unmeasured, and raising concurrency against an unknown quota risks 429 storms that burn the 3 attempts per row.
- **batchSize**: keep 200 for offers. Bigger batches gain almost nothing in the model (200 to 500: under 3%) and only raise the risk of crossing the 12 s headroom. For refresh keep 50, or use 100 if concurrency is raised; do not exceed batch seconds of about 12.
- **googleConcurrency**: this is the lever. At the assumed latencies offers at 10 take 11 min for 25,000 (13 links), at 20 about 5.6 min (7 links), at 40 about 2.9 min (4 links). Refresh at the default concurrency 5 takes about 67 min for 25,000 cards (63 to 84 links depending on batch size) and about 17 min at 20 with batch 100. The real refresh default batch of 50 is not in the sweep (batch size barely changes throughput; it only moves the links count). Raise offers to 20 and refresh to 10 to 20 **only after** production logs show Google answering without 429 at the current rate (section 6).
- **leaseSeconds**: 120 (offers) and 300 (refresh) are far above the modeled batch times (about 5 s and 8 s). Keep them: they only decide how soon a crashed worker's rows are retried. Lower them only if retries need to be faster; never below 3 times the slowest observed batch.
- **Daily cron**: keep the daily entry as the safety net; the real driver is the kick chain (each link re-kicks while work remains and progress was made). Hobby plans allow daily crons only, so a lost chain link (for example a deploy mid-chain) can stall a broadcast for up to 24 h. On Pro, change the schedule to every 5 to 10 minutes, since an empty run costs about two cheap queries.
- **Chain length**: at defaults a 25,000-recipient broadcast is about 13 chained 48 s invocations, and a 25,000-card refresh is about 60 or more. Each link is a full function invocation: fine for cost, but it is the reason to raise concurrency once Google tolerates it.

## 5. Limits of this check

- No real Apple or Google calls; their latency and quota are assumed. No 429 behavior modeled beyond the unit tests.
- SQL part: no PostgREST, no network, no multi-region latency (Vercel region vs Supabase region), warm cache, one machine, one run (no repeated trials, so treat numbers as orders of magnitude).
- The seed has one business. Several businesses draining at once share one Postgres and one function chain: not modeled.
- Function cold starts, memory, and the stamp-strip image rendering cost per refresh patch (inside the 800 ms assumption) are not measured.
- The simulation fake reproduces the claim semantics but not Postgres locking under real contention (that part is covered by the two-session SQL test).

## 6. Measure in production first

PR 6 adds one log line per batch, `{"batch":"offers"|"refresh","size","ms","delivered","failed"}` (counts and ms only, no identifiers). From Vercel logs:

1. **Per-pass latency** = ms / size × googleConcurrency. Compare with the 250 ms and 800 ms assumptions and rerun the model with `LAT_*`.
2. **Failure rate** (`failed` / `size`): any sustained 429s or 5xx means do not raise concurrency yet.
3. **Chain length** for the first real broadcast and the first real design change.
4. Whether claims get slow (slow batches with the DB calls dominating): then add the `(offer_id, customer_id) where delivered_at is null` index.
5. Ask Google Wallet for the real API quota for the issuer and compare it with the planned concurrency.
