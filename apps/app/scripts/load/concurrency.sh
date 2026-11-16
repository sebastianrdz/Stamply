#!/usr/bin/env bash
# Two simultaneous sessions drain the same offer; verifies no recipient is
# claimed twice. Usage: CONTAINER=stamply-load ./concurrency.sh
set -euo pipefail
C=${CONTAINER:-stamply-load}
psqlc() { docker exec -i "$C" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
OFFER=$(psqlc -c "insert into wallet_offers (business_id, body, delivery) values ('00000000-0000-0000-0000-0000000000b1','conc','pending') returning id" | head -1)
psqlc -c "truncate load.claimlog; truncate load.lat"
START=$(date +%s.%N)
psqlc -c "call load.drain_offer('$OFFER','A',200,true)" &
psqlc -c "call load.drain_offer('$OFFER','B',200,true)" &
wait
END=$(date +%s.%N)
echo "wall seconds: $(echo "$END - $START" | bc)"
psqlc -c "select 'claimed rows', count(*), 'distinct', count(distinct customer_id), 'dupes', count(*) - count(distinct customer_id) from load.claimlog"
psqlc -c "select 'per session', sess, count(*) from load.claimlog group by sess order by sess"
psqlc -c "select 'undelivered left', count(*) from wallet_offer_recipients where offer_id='$OFFER' and delivered_at is null"
