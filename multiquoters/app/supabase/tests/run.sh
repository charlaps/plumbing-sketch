#!/bin/bash
# Apply the local auth stub and migrations, then test the bid functions.
set -euo pipefail
cd "$(dirname "$0")"
PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'mq_test' AND pid <> pg_backend_pid();" >/dev/null || true
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS mq_test;"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE mq_test;"

"${PSQL[@]}" -d mq_test -f 00_local_auth.sql
"${PSQL[@]}" -d mq_test -f ../migrations/20261011120000_init.sql
"${PSQL[@]}" -d mq_test -f ../migrations/20261011120100_cron.sql
"${PSQL[@]}" -d mq_test -f 01_supabase_grants.sql
# Hosted Supabase applies the security script as non-superuser postgres.
"${PSQL[@]}" -d mq_test -f 03_apply_security_migration.sql
"${PSQL[@]}" -d mq_test -f 03_apply_security_migration.sql
"${PSQL[@]}" -d mq_test -v ON_ERROR_STOP=1 -c "
DO \$\$
BEGIN
  IF (SELECT rolsuper FROM pg_roles WHERE rolname = 'mq_postgres') THEN
    RAISE EXCEPTION 'mq_postgres must not be a superuser';
  END IF;
  IF pg_has_role('mq_postgres', 'supabase_admin', 'MEMBER') THEN
    RAISE EXCEPTION 'mq_postgres must not be a member of supabase_admin';
  END IF;
  IF pg_has_role('mq_postgres', 'postgres', 'MEMBER') THEN
    RAISE EXCEPTION 'mq_postgres must not be a member of postgres';
  END IF;
  IF (
    SELECT pg_get_userbyid(proowner)
    FROM pg_proc
    WHERE oid = 'public.send_message(uuid, text, uuid)'::regprocedure
  ) IS DISTINCT FROM 'mq_postgres' THEN
    RAISE EXCEPTION 'security migration was not applied as mq_postgres';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'mq_revoke_public_execute') THEN
    RAISE EXCEPTION 'non-superuser migration must not install the event trigger';
  END IF;
END
\$\$;
"
"${PSQL[@]}" -d mq_test -f 04_apply_launch_migration.sql
"${PSQL[@]}" -d mq_test -f 05_apply_retest_migration.sql
"${PSQL[@]}" -d mq_test -f rpc_test.sql
"${PSQL[@]}" -d mq_test -f security_test.sql

RACE=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
J1=$("${PSQL[@]}" -d mq_test -tA -c "SELECT id FROM public._t WHERE name = 'race_job_1'")
J2=$("${PSQL[@]}" -d mq_test -tA -c "SELECT id FROM public._t WHERE name = 'race_job_2'")

"${PSQL[@]}" -d mq_test -c "SELECT set_config('request.jwt.claim.sub', '${RACE}', false); SELECT public.place_bid('${J1}'::uuid, 3);" > /tmp/mq-race-1.txt &
P1=$!
"${PSQL[@]}" -d mq_test -c "SELECT set_config('request.jwt.claim.sub', '${RACE}', false); SELECT public.place_bid('${J2}'::uuid, 3);" > /tmp/mq-race-2.txt &
P2=$!
wait "$P1"
wait "$P2"

python3 - <<'PY'
from pathlib import Path
a = Path("/tmp/mq-race-1.txt").read_text()
b = Path("/tmp/mq-race-2.txt").read_text()
ok = a.count('"ok": true') + b.count('"ok": true')
bad = a.count("not enough tokens") + b.count("not enough tokens")
if ok != 1 or bad != 1:
    raise SystemExit("race failed\n---1---\n%s\n---2---\n%s" % (a, b))
print("ok: one of two parallel bids won, the other was rejected")
PY

"${PSQL[@]}" -d mq_test -v ON_ERROR_STOP=1 -c "
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 0
  AND (SELECT token_held FROM public.profiles WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 3
  AND (SELECT count(*) FROM public.bids WHERE contractor_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 1,
  'parallel bids hold 3 tokens once and store one bid'
);
"

BEFORE=$("${PSQL[@]}" -d mq_test -tA -c "SELECT count(*) FROM public.messages")
"${PSQL[@]}" -d mq_test -f 03_apply_security_migration.sql
AFTER=$("${PSQL[@]}" -d mq_test -tA -c "SELECT count(*) FROM public.messages")
if [ "$BEFORE" != "$AFTER" ]; then
  echo "security migration changed message count from $BEFORE to $AFTER" >&2
  exit 1
fi
"${PSQL[@]}" -d mq_test -v ON_ERROR_STOP=1 -c "
SELECT public._assert(
  NOT has_function_privilege('anon', 'public.release_hold(uuid, uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.bid_ranks(uuid)', 'EXECUTE')
  AND NOT has_table_privilege('anon', 'public.contractor_cards', 'UPDATE')
  AND has_function_privilege('authenticated', 'public.place_bid(uuid, integer)', 'EXECUTE')
  AND (SELECT count(*) FROM public.quotes WHERE status = 'accepted')
      = (SELECT count(DISTINCT job_id) FROM public.quotes WHERE status = 'accepted'),
  'running the security migration again keeps the locks in place'
);
"

"${PSQL[@]}" -d mq_test -f 04_apply_launch_migration.sql
"${PSQL[@]}" -d mq_test -f 05_apply_retest_migration.sql
"${PSQL[@]}" -d mq_test -f launch_test.sql
"${PSQL[@]}" -d mq_test -f retest_test.sql

echo "ALL TESTS PASSED"
