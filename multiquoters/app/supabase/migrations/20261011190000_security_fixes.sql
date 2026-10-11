-- Security fixes for the live Multiquoters database.
-- Apply once, in the Supabase SQL editor, after 20261011120000_init.sql
-- and 20261011120100_cron.sql. Safe to run again.
--
-- 1. Internal functions are no longer callable by anon or authenticated.
--    Triggers, pg_cron, and SECURITY DEFINER RPCs still run as the owner.
--    Row policies use mq_guard views instead of those functions, so revoking
--    EXECUTE does not break reads. Only the RPCs the website calls are granted.
-- 2. contractor_cards is read-only. Table write grants are limited to the
--    writes the website actually performs.
-- 3. A job can have one accepted quote, and only while it is matched or quoting.
-- 4. The other winners are told when a quote is accepted.
-- 5. Messages are one thread per client and contractor. After acceptance,
--    a contractor who was not chosen cannot post.
-- 6. A VIP lead keeps a single cover row, capped at the VIP allowance.

-- ---------------------------------------------------------------------------
-- Guard views. Not in the Data API schema. Each one returns only the caller's
-- own facts, and runs as the owner so policies do not recurse through RLS.
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS mq_guard;

REVOKE ALL ON SCHEMA mq_guard FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA mq_guard TO authenticated;

CREATE OR REPLACE VIEW mq_guard.i_am_admin AS
SELECT true AS ok
FROM public.profiles
WHERE id = auth.uid() AND role = 'admin';

CREATE OR REPLACE VIEW mq_guard.my_wins AS
SELECT job_id
FROM public.auction_results
WHERE contractor_id = auth.uid();

-- Same rule as public.contractor_can_see_job, inlined so policies do not
-- need EXECUTE on that function.
CREATE OR REPLACE VIEW mq_guard.visible_jobs AS
SELECT j.id AS job_id
FROM public.job_requests j
JOIN public.profiles p ON p.id = auth.uid()
WHERE p.role = 'contractor'
  AND NOT j.flagged
  AND j.status <> 'flagged'
  AND (
    (
      j.trade = ANY (p.trades)
      AND (j.area = ANY (p.areas) OR j.suburb = ANY (p.areas))
    )
    OR EXISTS (
      SELECT 1 FROM public.bids b
      WHERE b.job_id = j.id AND b.contractor_id = p.id
    )
    OR EXISTS (
      SELECT 1 FROM public.auction_results ar
      WHERE ar.job_id = j.id AND ar.contractor_id = p.id
    )
  );

ALTER VIEW mq_guard.i_am_admin SET (security_invoker = false, security_barrier = true);
ALTER VIEW mq_guard.my_wins SET (security_invoker = false, security_barrier = true);
ALTER VIEW mq_guard.visible_jobs SET (security_invoker = false, security_barrier = true);

REVOKE ALL ON mq_guard.i_am_admin FROM PUBLIC, anon, authenticated;
REVOKE ALL ON mq_guard.my_wins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON mq_guard.visible_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON mq_guard.i_am_admin, mq_guard.my_wins, mq_guard.visible_jobs TO authenticated;

-- ---------------------------------------------------------------------------
-- One accepted quote per job. If a job already has two, keep the earliest.
-- ---------------------------------------------------------------------------

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY job_id ORDER BY created_at, id) AS n
  FROM public.quotes
  WHERE status = 'accepted'
)
UPDATE public.quotes q
SET status = 'not_selected'
FROM ranked r
WHERE q.id = r.id AND r.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS quotes_one_accepted_per_job
  ON public.quotes (job_id)
  WHERE status = 'accepted';

-- ---------------------------------------------------------------------------
-- Messages belong to one client–contractor thread.
-- ---------------------------------------------------------------------------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES public.profiles (id);

-- A winner's own messages stay on that winner's thread.
UPDATE public.messages m
SET contractor_id = m.sender_id
WHERE m.contractor_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.auction_results ar
    WHERE ar.job_id = m.job_id AND ar.contractor_id = m.sender_id
  );

-- On a decided job, the client's earlier messages stay with the chosen contractor.
UPDATE public.messages m
SET contractor_id = q.contractor_id
FROM public.quotes q
WHERE m.contractor_id IS NULL
  AND q.job_id = m.job_id
  AND q.status = 'accepted';

-- Still-open jobs: each winner keeps the client messages they could already see.
INSERT INTO public.messages (job_id, sender_id, body, created_at, contractor_id)
SELECT m.job_id, m.sender_id, m.body, m.created_at, ar.contractor_id
FROM public.messages m
JOIN public.auction_results ar ON ar.job_id = m.job_id
WHERE m.contractor_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.messages existing
    WHERE existing.job_id = m.job_id
      AND existing.sender_id = m.sender_id
      AND existing.body = m.body
      AND existing.created_at = m.created_at
      AND existing.contractor_id = ar.contractor_id
  );

DELETE FROM public.messages WHERE contractor_id IS NULL;

ALTER TABLE public.messages ALTER COLUMN contractor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS messages_thread_idx
  ON public.messages (job_id, contractor_id, created_at);

-- ---------------------------------------------------------------------------
-- One VIP cover row per contractor per lead, never above the allowance.
-- ---------------------------------------------------------------------------

DELETE FROM public.token_ledger t
USING (
  SELECT id
  FROM (
    SELECT id, row_number() OVER (
      PARTITION BY profile_id, job_id
      ORDER BY created_at DESC, id DESC
    ) AS n
    FROM public.token_ledger
    WHERE entry_type = 'vip_cover'
  ) ranked
  WHERE n > 1
) old
WHERE t.id = old.id;

UPDATE public.token_ledger
SET tokens = LEAST(tokens, COALESCE(public.setting_int('vip_free_tokens'), 5))
WHERE entry_type = 'vip_cover'
  AND tokens > COALESCE(public.setting_int('vip_free_tokens'), 5);

CREATE UNIQUE INDEX IF NOT EXISTS token_ledger_one_vip_cover
  ON public.token_ledger (profile_id, job_id)
  WHERE entry_type = 'vip_cover' AND job_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.collapse_vip_cover() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.entry_type IS DISTINCT FROM 'vip_cover' THEN
    RETURN NEW;
  END IF;
  NEW.tokens := LEAST(NEW.tokens, COALESCE(public.setting_int('vip_free_tokens'), 5));
  DELETE FROM public.token_ledger
  WHERE profile_id = NEW.profile_id
    AND job_id IS NOT DISTINCT FROM NEW.job_id
    AND entry_type = 'vip_cover'
    AND id IS DISTINCT FROM NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS token_ledger_one_vip_cover ON public.token_ledger;
CREATE TRIGGER token_ledger_one_vip_cover
  BEFORE INSERT ON public.token_ledger
  FOR EACH ROW EXECUTE FUNCTION public.collapse_vip_cover();

-- ---------------------------------------------------------------------------
-- Accept one quote, tell the other winners, and move the job to accepted.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_quote(p_quote uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_job uuid;
  v_contractor uuid;
  v_client uuid;
  v_job_status text;
  v_quote_status text;
  rec record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT job_id INTO v_job FROM public.quotes WHERE id = p_quote;
  IF v_job IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote not found');
  END IF;

  SELECT status, client_id INTO v_job_status, v_client
  FROM public.job_requests
  WHERE id = v_job
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote not found');
  END IF;

  SELECT contractor_id, status INTO v_contractor, v_quote_status
  FROM public.quotes
  WHERE id = p_quote
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote not found');
  END IF;

  IF v_client <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not your request');
  END IF;
  IF v_job_status NOT IN ('matched', 'quoting') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quotes are closed');
  END IF;
  IF v_quote_status <> 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote cannot be accepted');
  END IF;

  UPDATE public.quotes
  SET status = 'not_selected'
  WHERE job_id = v_job AND id <> p_quote AND status <> 'not_selected';
  UPDATE public.quotes SET status = 'accepted' WHERE id = p_quote;
  UPDATE public.job_requests SET status = 'accepted' WHERE id = v_job;

  PERFORM public.notify(v_contractor, 'Quote accepted',
    'The client accepted your quote. You can message them here.',
    '#/contractor/lead/' || v_job);

  FOR rec IN
    SELECT contractor_id
    FROM public.auction_results
    WHERE job_id = v_job AND contractor_id <> v_contractor
  LOOP
    PERFORM public.notify(rec.contractor_id, 'Another quote was chosen',
      'The client chose a different contractor for this job. Thank you for taking part.',
      '#/contractor/lead/' || v_job);
  END LOOP;

  PERFORM public.audit_write('accept_quote', 'quotes', p_quote, jsonb_build_object('job', v_job));
  RETURN jsonb_build_object('ok', true, 'job_id', v_job);
END;
$$;

-- ---------------------------------------------------------------------------
-- One thread per contractor. Losing contractors cannot post after acceptance.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.send_message(uuid, text);
DROP FUNCTION IF EXISTS public.send_message(uuid, text, uuid);

CREATE FUNCTION public.send_message(p_job uuid, p_body text, p_contractor uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_client uuid;
  v_thread uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF COALESCE(btrim(p_body), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty message');
  END IF;

  SELECT status, client_id INTO v_status, v_client
  FROM public.job_requests WHERE id = p_job;
  IF v_status NOT IN ('matched', 'quoting', 'accepted') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'messaging opens after the auction');
  END IF;

  IF v_uid = v_client THEN
    v_thread := p_contractor;
    IF v_thread IS NULL OR NOT public.is_winner(p_job, v_thread) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'choose a contractor on this job');
    END IF;
  ELSIF public.is_winner(p_job, v_uid) THEN
    v_thread := v_uid;
  ELSIF public.is_admin() THEN
    v_thread := p_contractor;
    IF v_thread IS NULL OR NOT public.is_winner(p_job, v_thread) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'choose a contractor on this job');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'not allowed');
  END IF;

  IF v_status = 'accepted' AND NOT EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.job_id = p_job AND q.contractor_id = v_thread AND q.status = 'accepted'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'this conversation is closed');
  END IF;

  INSERT INTO public.messages (job_id, sender_id, body, contractor_id)
  VALUES (p_job, v_uid, btrim(p_body), v_thread);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Policies no longer call internal functions.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM mq_guard.i_am_admin));

DROP POLICY IF EXISTS jobs_select ON public.job_requests;
CREATE POLICY jobs_select ON public.job_requests
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
    OR EXISTS (SELECT 1 FROM mq_guard.visible_jobs v WHERE v.job_id = job_requests.id)
  );

DROP POLICY IF EXISTS private_select ON public.request_private;
CREATE POLICY private_select ON public.request_private
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS photos_select ON public.request_photos;
CREATE POLICY photos_select ON public.request_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM mq_guard.my_wins w WHERE w.job_id = request_photos.job_id)
  );

DROP POLICY IF EXISTS bids_select ON public.bids;
CREATE POLICY bids_select ON public.bids
  FOR SELECT TO authenticated
  USING (contractor_id = auth.uid() OR EXISTS (SELECT 1 FROM mq_guard.i_am_admin));

DROP POLICY IF EXISTS results_select ON public.auction_results;
CREATE POLICY results_select ON public.auction_results
  FOR SELECT TO authenticated
  USING (
    contractor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS quotes_select ON public.quotes;
CREATE POLICY quotes_select ON public.quotes
  FOR SELECT TO authenticated
  USING (
    contractor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS quote_items_select ON public.quote_items;
CREATE POLICY quote_items_select ON public.quote_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quotes q
      JOIN public.job_requests j ON j.id = q.job_id
      WHERE q.id = quote_id
        AND (
          q.contractor_id = auth.uid()
          OR j.client_id = auth.uid()
          OR EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
        )
    )
  );

DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
    OR (
      contractor_id = auth.uid()
      AND EXISTS (SELECT 1 FROM mq_guard.my_wins w WHERE w.job_id = messages.job_id)
    )
  );

DROP POLICY IF EXISTS ledger_select ON public.token_ledger;
CREATE POLICY ledger_select ON public.token_ledger
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM mq_guard.i_am_admin));

DROP POLICY IF EXISTS vip_select ON public.vip_memberships;
CREATE POLICY vip_select ON public.vip_memberships
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM mq_guard.i_am_admin));

DROP POLICY IF EXISTS audit_select ON public.audit;
CREATE POLICY audit_select ON public.audit
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM mq_guard.i_am_admin));

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM mq_guard.i_am_admin));

DROP POLICY IF EXISTS bid_feed_select ON public.bid_feed;
CREATE POLICY bid_feed_select ON public.bid_feed
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM mq_guard.visible_jobs v WHERE v.job_id = bid_feed.job_id)
  );

-- ---------------------------------------------------------------------------
-- Contractor directory: public read of safe columns, no writes.
-- A subquery keeps the view from being auto-updatable.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.contractor_cards AS
SELECT id, business_name, full_name, trades, areas, vat_registered, verified, vip
FROM (
  SELECT
    id,
    business_name,
    full_name,
    trades,
    areas,
    vat_registered,
    verified,
    (vip_until IS NOT NULL AND vip_until > now()) AS vip
  FROM public.profiles
  WHERE role = 'contractor'
) cards;

ALTER VIEW public.contractor_cards SET (security_invoker = false, security_barrier = true);

-- ---------------------------------------------------------------------------
-- Function privileges. Supabase grants EXECUTE to anon and authenticated by
-- default; REVOKE FROM PUBLIC does not remove those grants. Postgres also
-- grants EXECUTE to PUBLIC on every new function, and that built-in grant is
-- not cleared by ALTER DEFAULT PRIVILEGES, so an event trigger revokes it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION mq_guard.revoke_public_execute() RETURNS event_trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT object_identity
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE FUNCTION'
      AND schema_name = 'public'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      obj.object_identity
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION mq_guard.revoke_public_execute() FROM PUBLIC, anon, authenticated;

-- Event triggers need a superuser. If this role cannot create one, the
-- explicit revokes below still lock every function that already exists.
DO $event$
BEGIN
  DROP EVENT TRIGGER IF EXISTS mq_revoke_public_execute;
  CREATE EVENT TRIGGER mq_revoke_public_execute
    ON ddl_command_end
    WHEN TAG IN ('CREATE FUNCTION')
    EXECUTE FUNCTION mq_guard.revoke_public_execute();
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not install mq_revoke_public_execute (%). Existing functions are locked. A superuser should install that event trigger so new public functions are not granted to anon or authenticated.', SQLERRM;
END
$event$;

DO $revoke_fn$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END
$revoke_fn$;

GRANT EXECUTE ON FUNCTION public.public_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_contractor(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_verification_doc(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_job(text, text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_bid(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bid_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlocked_contacts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_quote(uuid, integer, integer, integer, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_quote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_tokens(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_vip(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_contractor(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flag_job(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read() TO authenticated;

-- Sign-up inserts auth.users as supabase_auth_admin. The trigger fires without
-- this grant on current Postgres; the grant keeps that role explicit.
DO $auth_admin$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
  END IF;
END
$auth_admin$;

-- New functions in public are not executable by the API roles.
DO $defaults$
DECLARE
  r name;
BEGIN
  FOR r IN
    SELECT rolname FROM pg_roles
    WHERE rolname IN ('postgres', 'supabase_admin') OR rolname = current_user
  LOOP
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated',
      r
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated',
      r
    );
  END LOOP;
END
$defaults$;

-- ---------------------------------------------------------------------------
-- Table privileges. RLS stays in place. Writes the website does not use are
-- removed, including the grants Supabase applies to new tables by default.
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, role, full_name, business_name, trades, areas, vat_registered, verified,
  vip_until, phone, user_code, token_available, token_held, created_at
) ON public.profiles TO authenticated;

GRANT UPDATE (
  full_name, business_name, trades, areas, vat_registered, phone
) ON public.profiles TO authenticated;

GRANT SELECT ON public.job_requests TO authenticated;
GRANT SELECT ON public.request_private TO authenticated;
GRANT SELECT, INSERT ON public.request_photos TO authenticated;
GRANT SELECT ON public.bids TO authenticated;
GRANT SELECT ON public.auction_results TO authenticated;
GRANT SELECT ON public.quotes TO authenticated;
GRANT SELECT ON public.quote_items TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.token_ledger TO authenticated;
GRANT SELECT ON public.vip_memberships TO authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT SELECT ON public.audit TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT SELECT ON public.bid_feed TO authenticated;
GRANT SELECT ON public.contractor_cards TO anon, authenticated;

-- Photo reads use the guard views, same audience as before.
DO $storage$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'storage schema not present — photo policies were left as they are';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS mq_job_photos_read ON storage.objects;
  CREATE POLICY mq_job_photos_read ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'job-photos' AND (
        EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
        OR EXISTS (
          SELECT 1 FROM public.job_requests j
          WHERE j.id::text = (storage.foldername(name))[1] AND j.client_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM mq_guard.my_wins w
          WHERE w.job_id = ((storage.foldername(name))[1])::uuid
        )
      )
    );

  DROP POLICY IF EXISTS mq_verification_read ON storage.objects;
  CREATE POLICY mq_verification_read ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'verification' AND (
        EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
        OR (storage.foldername(name))[1] = auth.uid()::text
      )
    );
END
$storage$;
