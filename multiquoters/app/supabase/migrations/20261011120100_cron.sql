-- Closes expired auctions once a minute.
-- If pg_cron is not installed this file does nothing harmful.
-- On Supabase: Database → Extensions → enable pg_cron, then run this file.

DO $cron$
DECLARE
  v_jobid bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not installed. Enable it under Database → Extensions, then run this file again.';
    RETURN;
  END IF;
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create pg_cron (%). Enable it in the dashboard, then run this file again.', SQLERRM;
    RETURN;
  END;
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron tables are not visible. Enable the extension in the dashboard, then run this file again.';
    RETURN;
  END IF;
  FOR v_jobid IN SELECT jobid FROM cron.job WHERE jobname = 'mq_close_auctions'
  LOOP
    PERFORM cron.unschedule(v_jobid);
  END LOOP;
  PERFORM cron.schedule(
    'mq_close_auctions',
    '* * * * *',
    'SELECT public.close_expired_auctions()'
  );
  RAISE NOTICE 'Scheduled mq_close_auctions every minute';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron was not scheduled (%). Enable the extension, then run this file again.', SQLERRM;
END $cron$;
