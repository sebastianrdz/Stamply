# Load check scripts

Throwaway-database measurements for the broadcast queue (see
`docs/product/broadcast-scale-load-check.md`). Never point these at a real
Supabase project: they create tables and 25,000 rows.

```sh
docker run -d --rm --name stamply-load -e POSTGRES_PASSWORD=pw \
  public.ecr.aws/supabase/postgres:17.11.0.018
until docker exec stamply-load pg_isready -U supabase_admin -q; do sleep 2; done
cd apps/app/supabase/migrations
# 0003 and 0024 need the storage schema, which that image lacks
for f in $(ls *.sql | grep -v '^0003_\|^0024_'); do
  docker exec -i stamply-load psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q < $f
done
cd ../../scripts/load
docker exec -i stamply-load psql -U supabase_admin -d postgres -f - < seed.sql
docker exec -i stamply-load psql -U supabase_admin -d postgres -f - < measure.sql
./concurrency.sh            # two simultaneous drainers, checks for duplicate claims
docker stop stamply-load
```

`measure.sql` covers: broadcast creation, claim/drain timings with EXPLAIN
(including the 24,000-already-delivered worst case), the refresh queue, the
status functions and table sizes. Run it once per fresh database (it creates
extra offers each time).

The worker simulation with injected latency lives in
`apps/app/src/lib/wallet/push-worker.load.test.ts` (`LOAD=1`).
