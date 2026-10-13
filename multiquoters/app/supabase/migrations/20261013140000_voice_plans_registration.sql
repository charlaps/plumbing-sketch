-- Voice notes, plan files, and trade-body registration.
-- Apply after 20261012210000_retest_fixes.sql. Safe to run again.
-- Hosted Supabase runs this as postgres, which is not a superuser.
-- Money movement is unchanged. Admins still cannot bid.
-- If you re-run the launch or retest script after this one, run this file
-- again so place_bid keeps the registration check.

-- ---------------------------------------------------------------------------
-- Governing bodies. Plumbing, geyser, electrical and building are required.
-- Painting, solar, handyman and roofing are optional. Gas is SAQCC Gas for
-- when that trade is used; it is not in the client trade list.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.governing_bodies (
  code text PRIMARY KEY,
  name text NOT NULL,
  short_label text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.trade_body_rules (
  trade text NOT NULL,
  body_code text NOT NULL REFERENCES public.governing_bodies (code),
  required boolean NOT NULL DEFAULT false,
  PRIMARY KEY (trade, body_code)
);

CREATE TABLE IF NOT EXISTS public.contractor_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  trade text NOT NULL,
  body_code text NOT NULL REFERENCES public.governing_bodies (code),
  registration_number text NOT NULL,
  expires_on date NOT NULL,
  proof_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contractor_registrations_profile_idx
  ON public.contractor_registrations (profile_id, trade, status);

CREATE UNIQUE INDEX IF NOT EXISTS contractor_registrations_open_idx
  ON public.contractor_registrations (profile_id, trade, body_code)
  WHERE status IN ('pending', 'verified');

INSERT INTO public.governing_bodies (code, name, short_label) VALUES
  ('pirb', 'Plumbing Industry Registration Board', 'PIRB'),
  ('doel', 'Department of Employment and Labour', 'Wireman''s licence'),
  ('eca', 'Electrical Contractors'' Association of South Africa', 'ECA'),
  ('saqcc', 'SAQCC Gas', 'SAQCC Gas'),
  ('nhbrc', 'National Home Builders Registration Council', 'NHBRC')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, short_label = EXCLUDED.short_label;

INSERT INTO public.trade_body_rules (trade, body_code, required) VALUES
  ('Plumbing', 'pirb', true),
  ('Geyser', 'pirb', true),
  ('Electrical', 'doel', true),
  ('Electrical', 'eca', false),
  ('Solar', 'pirb', false),
  ('Solar', 'doel', false),
  ('Building', 'nhbrc', true),
  ('Roofing', 'nhbrc', false),
  ('Gas', 'saqcc', true)
ON CONFLICT (trade, body_code) DO UPDATE
SET required = EXCLUDED.required;

-- ---------------------------------------------------------------------------
-- Job voice notes and drawings. Private. Same readers as job photos:
-- the client, a contractor in the top 3, and an admin.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_audio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime text NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 120),
  bytes integer NOT NULL CHECK (bytes > 0 AND bytes <= 4194304),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_audio_job_idx ON public.job_audio (job_id);

CREATE TABLE IF NOT EXISTS public.job_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime text NOT NULL,
  bytes integer NOT NULL CHECK (bytes > 0 AND bytes <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_plans_job_idx ON public.job_plans (job_id);

CREATE OR REPLACE FUNCTION public.guard_job_audio() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_count integer;
  v_mime text := lower(split_part(COALESCE(NEW.mime, ''), ';', 1));
BEGIN
  IF split_part(NEW.storage_path, '/', 1) IS DISTINCT FROM NEW.job_id::text
     OR position('/' IN NEW.storage_path) = 0
     OR NEW.storage_path LIKE '%..%' THEN
    RAISE EXCEPTION 'file must be in the job folder' USING ERRCODE = '23514';
  END IF;
  IF v_mime NOT IN (
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav',
    'audio/x-wav', 'audio/ogg', 'audio/x-m4a', 'audio/mp3', 'audio/m4a'
  ) THEN
    RAISE EXCEPTION 'unsupported audio type' USING ERRCODE = '23514';
  END IF;
  SELECT count(*) INTO v_count FROM public.job_audio WHERE job_id = NEW.job_id;
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'too many voice notes' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_audio_guard ON public.job_audio;
CREATE TRIGGER job_audio_guard
  BEFORE INSERT ON public.job_audio
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_audio();

CREATE OR REPLACE FUNCTION public.guard_job_plan() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_count integer;
  v_mime text := lower(split_part(COALESCE(NEW.mime, ''), ';', 1));
BEGIN
  IF split_part(NEW.storage_path, '/', 1) IS DISTINCT FROM NEW.job_id::text
     OR position('/' IN NEW.storage_path) = 0
     OR NEW.storage_path LIKE '%..%' THEN
    RAISE EXCEPTION 'file must be in the job folder' USING ERRCODE = '23514';
  END IF;
  IF v_mime NOT IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif') THEN
    RAISE EXCEPTION 'unsupported plan type' USING ERRCODE = '23514';
  END IF;
  IF length(btrim(NEW.file_name)) = 0 OR length(NEW.file_name) > 180
     OR NEW.file_name LIKE '%/%' OR NEW.file_name LIKE '%\%' THEN
    RAISE EXCEPTION 'plan name is not valid' USING ERRCODE = '23514';
  END IF;
  SELECT count(*) INTO v_count FROM public.job_plans WHERE job_id = NEW.job_id;
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'too many plans' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_plan_guard ON public.job_plans;
CREATE TRIGGER job_plan_guard
  BEFORE INSERT ON public.job_plans
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_plan();

-- ---------------------------------------------------------------------------
-- Registration checks. Internal. Not granted to anon or authenticated.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registration_ok(p_profile uuid, p_trade text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.trade_body_rules rule
    WHERE rule.trade = p_trade
      AND rule.required
      AND NOT EXISTS (
        SELECT 1
        FROM public.contractor_registrations r
        WHERE r.profile_id = p_profile
          AND r.trade = rule.trade
          AND r.body_code = rule.body_code
          AND r.status = 'verified'
          AND r.expires_on >= current_date
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.expire_registrations(p_profile uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec record;
  v_admin uuid;
  v_count integer := 0;
  v_label text;
BEGIN
  FOR rec IN
    UPDATE public.contractor_registrations r
    SET status = 'expired', updated_at = now()
    WHERE r.status = 'verified'
      AND r.expires_on < current_date
      AND (p_profile IS NULL OR r.profile_id = p_profile)
    RETURNING r.id, r.profile_id, r.trade, r.body_code, r.expires_on
  LOOP
    v_count := v_count + 1;
    SELECT short_label INTO v_label FROM public.governing_bodies WHERE code = rec.body_code;
    v_label := COALESCE(v_label, rec.body_code);
    PERFORM public.notify(
      rec.profile_id,
      'Registration expired',
      'Your ' || v_label || ' registration for ' || rec.trade || ' expired on '
        || to_char(rec.expires_on, 'YYYY-MM-DD')
        || '. Upload the new card before you bid on that trade.',
      '#/contractor/registration'
    );
    PERFORM public.audit_write(
      'registration_expired', 'contractor_registrations', rec.id,
      jsonb_build_object('trade', rec.trade, 'body', rec.body_code, 'expires_on', rec.expires_on)
    );
    FOR v_admin IN SELECT id FROM public.profiles WHERE role = 'admin'
    LOOP
      PERFORM public.notify(
        v_admin,
        'Registration expired',
        v_label || ' for ' || rec.trade || ' expired on ' || to_char(rec.expires_on, 'YYYY-MM-DD') || '.',
        '#/admin'
      );
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_registration(
  p_trade text,
  p_body text,
  p_number text,
  p_expires date,
  p_proof_path text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_trades text[];
  v_number text := btrim(COALESCE(p_number, ''));
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT role, trades INTO v_role, v_trades FROM public.profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'contractor' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contractors only');
  END IF;
  IF COALESCE(p_trade, '') = '' OR NOT (p_trade = ANY (v_trades)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'choose one of your trades');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_body_rules
    WHERE trade = p_trade AND body_code = p_body
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'that body is not used for this trade');
  END IF;
  IF length(v_number) < 3 OR length(v_number) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'enter the registration number');
  END IF;
  IF p_expires IS NULL OR p_expires < current_date THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expiry must be today or later');
  END IF;
  IF COALESCE(p_proof_path, '') = ''
     OR split_part(p_proof_path, '/', 1) <> v_uid::text
     OR p_proof_path LIKE '%..%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'file must be in your folder');
  END IF;

  PERFORM public.expire_registrations(v_uid);

  IF EXISTS (
    SELECT 1 FROM public.contractor_registrations
    WHERE profile_id = v_uid
      AND trade = p_trade
      AND body_code = p_body
      AND status = 'verified'
      AND expires_on >= current_date
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already registered');
  END IF;

  UPDATE public.contractor_registrations
  SET registration_number = v_number,
      expires_on = p_expires,
      proof_path = p_proof_path,
      review_note = NULL,
      updated_at = now()
  WHERE profile_id = v_uid
    AND trade = p_trade
    AND body_code = p_body
    AND status = 'pending'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO public.contractor_registrations (
      profile_id, trade, body_code, registration_number, expires_on, proof_path, status
    ) VALUES (
      v_uid, p_trade, p_body, v_number, p_expires, p_proof_path, 'pending'
    )
    RETURNING id INTO v_id;
  END IF;

  PERFORM public.notify(
    v_uid,
    'Registration sent',
    'An admin will check your ' || p_trade || ' registration. You can browse leads while you wait.',
    '#/contractor/registration'
  );
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_registration(
  p_id uuid,
  p_decision text,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.contractor_registrations%ROWTYPE;
  v_label text;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_decision NOT IN ('verified', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'decision must be verified or rejected');
  END IF;
  IF p_decision = 'rejected' AND COALESCE(length(v_reason), 0) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'a reason is required');
  END IF;

  SELECT * INTO v_row FROM public.contractor_registrations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'registration not found');
  END IF;
  IF p_decision = 'verified' AND v_row.expires_on < current_date THEN
    UPDATE public.contractor_registrations
    SET status = 'expired', updated_at = now(), reviewed_at = now(), reviewed_by = auth.uid()
    WHERE id = p_id;
    RETURN jsonb_build_object('ok', false, 'error', 'registration has expired');
  END IF;

  UPDATE public.contractor_registrations
  SET status = p_decision,
      review_note = CASE WHEN p_decision = 'rejected' THEN v_reason ELSE NULL END,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  WHERE id = p_id;

  SELECT short_label INTO v_label FROM public.governing_bodies WHERE code = v_row.body_code;
  v_label := COALESCE(v_label, v_row.body_code);

  PERFORM public.audit_write(
    'review_registration', 'contractor_registrations', p_id,
    jsonb_build_object('decision', p_decision, 'trade', v_row.trade, 'body', v_row.body_code)
  );
  PERFORM public.notify(
    v_row.profile_id,
    CASE WHEN p_decision = 'verified' THEN v_label || ' verified' ELSE 'Registration not accepted' END,
    CASE
      WHEN p_decision = 'verified' THEN
        'Your ' || v_label || ' registration for ' || v_row.trade || ' is verified. You can bid on matching leads.'
      ELSE
        'Your ' || v_label || ' registration was not accepted. ' || COALESCE(v_reason, '')
    END,
    '#/contractor/registration'
  );
  RETURN jsonb_build_object('ok', true, 'status', p_decision);
END;
$$;

-- Badges for quotes and compare. Registration numbers stay off this view.
CREATE OR REPLACE VIEW public.registration_badges AS
SELECT r.profile_id, r.trade, b.short_label, b.name AS body_name
FROM (
  SELECT profile_id, trade, body_code
  FROM public.contractor_registrations
  WHERE status = 'verified' AND expires_on >= current_date
) r
JOIN public.governing_bodies b ON b.code = r.body_code;

ALTER VIEW public.registration_badges SET (security_invoker = false, security_barrier = true);

-- ---------------------------------------------------------------------------
-- Profile, public card and admin list include registration state.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.my_profile() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL THEN
    PERFORM public.expire_registrations(v_uid);
  END IF;
  SELECT jsonb_build_object(
    'id', id,
    'role', role,
    'full_name', full_name,
    'business_name', business_name,
    'trades', to_jsonb(trades),
    'areas', to_jsonb(areas),
    'vat_registered', vat_registered,
    'verified', verified,
    'verification_docs', verification_docs,
    'vip_until', vip_until,
    'phone', phone,
    'user_code', user_code,
    'token_available', token_available,
    'token_held', token_held,
    'terms_accepted_at', terms_accepted_at,
    'registrations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'trade', r.trade,
        'body_code', r.body_code,
        'body_name', b.name,
        'short_label', b.short_label,
        'registration_number', r.registration_number,
        'expires_on', r.expires_on,
        'status', r.status,
        'review_note', r.review_note,
        'proof_path', r.proof_path
      ) ORDER BY r.created_at DESC)
      FROM public.contractor_registrations r
      JOIN public.governing_bodies b ON b.code = r.body_code
      WHERE r.profile_id = profiles.id
    ), '[]'::jsonb),
    'trade_rules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'trade', rule.trade,
        'body_code', rule.body_code,
        'body_name', b.name,
        'short_label', b.short_label,
        'required', rule.required
      ) ORDER BY rule.trade, rule.required DESC, b.short_label)
      FROM public.trade_body_rules rule
      JOIN public.governing_bodies b ON b.code = rule.body_code
    ), '[]'::jsonb)
  ) INTO v
  FROM public.profiles
  WHERE id = v_uid;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_contractor(p_code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'business_name', p.business_name,
    'full_name', p.full_name,
    'trades', to_jsonb(p.trades),
    'areas', to_jsonb(p.areas),
    'vat_registered', p.vat_registered,
    'verified', p.verified,
    'vip', (p.vip_until IS NOT NULL AND p.vip_until > now()),
    'user_code', p.user_code,
    'badges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'trade', rb.trade,
        'short_label', rb.short_label,
        'body_name', rb.body_name
      ) ORDER BY rb.short_label)
      FROM public.registration_badges rb
      WHERE rb.profile_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.profiles p
  WHERE p.user_code = upper(btrim(p_code)) AND p.role = 'contractor';
$$;

CREATE OR REPLACE FUNCTION public.admin_snapshot() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  PERFORM public.expire_registrations(NULL);
  RETURN jsonb_build_object(
    'contractors', COALESCE((
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.created_at DESC)
      FROM (
        SELECT p.id, p.full_name, p.business_name, p.verified, p.trades, p.areas,
               p.token_available, p.token_held, p.vip_until, p.user_code, p.phone,
               p.verification_docs, u.email, p.created_at,
               COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                   'id', r.id,
                   'trade', r.trade,
                   'body_code', r.body_code,
                   'body_name', b.name,
                   'short_label', b.short_label,
                   'registration_number', r.registration_number,
                   'expires_on', r.expires_on,
                   'status', r.status,
                   'review_note', r.review_note,
                   'proof_path', r.proof_path
                 ) ORDER BY r.created_at DESC)
                 FROM public.contractor_registrations r
                 JOIN public.governing_bodies b ON b.code = r.body_code
                 WHERE r.profile_id = p.id
               ), '[]'::jsonb) AS registrations
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.id
        WHERE p.role = 'contractor'
        ORDER BY p.created_at DESC
        LIMIT 200
      ) c
    ), '[]'::jsonb),
    'jobs', COALESCE((
      SELECT jsonb_agg(row_to_json(j) ORDER BY j.created_at DESC)
      FROM (
        SELECT jr.id, jr.title, jr.trade, jr.suburb, jr.area, jr.status, jr.flagged, jr.flag_reason,
               jr.auction_ends_at, jr.created_at, jr.client_id,
               (SELECT count(DISTINCT contractor_id) FROM public.bids b WHERE b.job_id = jr.id) AS bidders,
               (SELECT count(*) FROM public.quotes q WHERE q.job_id = jr.id) AS quotes
        FROM public.job_requests jr
        ORDER BY jr.created_at DESC
        LIMIT 200
      ) j
    ), '[]'::jsonb),
    'tokens_rand', COALESCE((
      SELECT sum(rand) FROM public.token_ledger WHERE entry_type IN ('grant', 'purchase')
    ), 0),
    'vip_members', (
      SELECT count(*) FROM public.profiles WHERE vip_until IS NOT NULL AND vip_until > now()
    ),
    'vip_revenue', COALESCE((SELECT sum(price_rand) FROM public.vip_memberships), 0)
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.place_bid(p_job uuid, p_amount integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_job public.job_requests%ROWTYPE;
  v_me public.profiles%ROWTYPE;
  v_free integer;
  v_rand integer;
  v_places integer;
  v_min integer;
  v_third integer;
  v_own integer;
  v_count integer;
  v_my_rank integer;
  v_due integer;
  v_covered integer;
  v_prev integer;
  v_extra integer;
  v_vip boolean;
  v_prev_top uuid[];
  v_prev_ranks jsonb;
  v_old integer;
  v_closed jsonb;
  rec record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bid too low', 'min', 1);
  END IF;

  SELECT * INTO v_job FROM public.job_requests WHERE id = p_job FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job not found');
  END IF;
  IF v_job.flagged OR v_job.status = 'flagged' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead unavailable');
  END IF;
  IF v_job.status = 'open' AND v_job.auction_ends_at <= now() THEN
    v_closed := public.close_auction(p_job);
    IF COALESCE(v_closed ->> 'extended', 'false') <> 'true' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'auction closed');
    END IF;
    SELECT * INTO v_job FROM public.job_requests WHERE id = p_job;
  END IF;
  IF v_job.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auction closed');
  END IF;

  SELECT * INTO v_me FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND OR v_me.role <> 'contractor' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contractors only');
  END IF;
  IF NOT v_me.verified THEN
    RETURN jsonb_build_object('ok', false, 'error', 'verification required');
  END IF;
  IF NOT (v_job.trade = ANY (v_me.trades)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'trade does not match');
  END IF;
  IF NOT (v_job.area = ANY (v_me.areas) OR v_job.suburb = ANY (v_me.areas)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'area does not match');
  END IF;

  -- Trade registration is checked after the ID flag. Money movement below is unchanged.
  PERFORM public.expire_registrations(v_uid);
  IF NOT public.registration_ok(v_uid, v_job.trade) THEN
    IF EXISTS (
      SELECT 1
      FROM public.trade_body_rules rule
      JOIN public.contractor_registrations r
        ON r.profile_id = v_uid
       AND r.trade = rule.trade
       AND r.body_code = rule.body_code
      WHERE rule.trade = v_job.trade
        AND rule.required
        AND r.status = 'expired'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'registration expired');
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'registration required');
  END IF;

  v_free := COALESCE(public.setting_int('vip_free_tokens'), 5);
  v_rand := COALESCE(public.setting_int('token_rand'), 20);
  v_places := COALESCE(public.setting_int('places'), 3);

  SELECT count(*) INTO v_count FROM public.bid_ranks(p_job);
  SELECT amount, rk INTO v_own, v_my_rank FROM public.bid_ranks(p_job) WHERE contractor_id = v_uid;
  SELECT amount INTO v_third FROM public.bid_ranks(p_job) WHERE rk = v_places;

  IF v_my_rank IS NOT NULL AND v_my_rank <= v_places THEN
    v_min := v_own + 1;
  ELSIF v_count < v_places THEN
    v_min := 1;
  ELSE
    v_min := COALESCE(v_third, 0) + 1;
  END IF;

  IF p_amount < v_min THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bid too low', 'min', v_min);
  END IF;

  SELECT COALESCE(array_agg(contractor_id), '{}'::uuid[]) INTO v_prev_top
  FROM public.bid_ranks(p_job)
  WHERE rk <= v_places;

  SELECT COALESCE(jsonb_object_agg(contractor_id::text, rk), '{}'::jsonb)
  INTO v_prev_ranks
  FROM public.bid_ranks(p_job);

  -- Lock the bidder and every current holder in a stable order, after the job lock.
  PERFORM p.id
  FROM public.profiles p
  WHERE p.id = v_uid
     OR p.id IN (SELECT h.profile_id FROM public.token_holds h WHERE h.job_id = p_job)
  ORDER BY p.id
  FOR UPDATE;

  SELECT * INTO v_me FROM public.profiles WHERE id = v_uid;
  v_vip := v_me.vip_until IS NOT NULL AND v_me.vip_until > now();
  IF v_vip THEN
    v_due := GREATEST(0, p_amount - v_free);
    v_covered := LEAST(p_amount, v_free);
  ELSE
    v_due := p_amount;
    v_covered := 0;
  END IF;

  SELECT tokens INTO v_prev FROM public.token_holds WHERE profile_id = v_uid AND job_id = p_job;
  v_extra := v_due - COALESCE(v_prev, 0);

  IF v_extra > v_me.token_available THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not enough tokens', 'need', v_extra, 'available', v_me.token_available);
  END IF;

  INSERT INTO public.bids (job_id, contractor_id, amount) VALUES (p_job, v_uid, p_amount);
  INSERT INTO public.bid_feed (job_id, amount) VALUES (p_job, p_amount);

  IF v_extra > 0 THEN
    UPDATE public.profiles
    SET token_available = token_available - v_extra,
        token_held = token_held + v_extra,
        updated_at = now()
    WHERE id = v_uid;
    INSERT INTO public.token_ledger (profile_id, job_id, entry_type, tokens, rand, note)
    VALUES (v_uid, p_job, 'hold', v_extra, v_extra * v_rand, 'Held for bid');
  ELSIF v_extra < 0 THEN
    UPDATE public.profiles
    SET token_available = token_available + (-v_extra),
        token_held = token_held - (-v_extra),
        updated_at = now()
    WHERE id = v_uid;
    INSERT INTO public.token_ledger (profile_id, job_id, entry_type, tokens, rand, note)
    VALUES (v_uid, p_job, 'release', -v_extra, (-v_extra) * v_rand, 'Hold reduced');
  END IF;

  INSERT INTO public.token_holds (profile_id, job_id, tokens)
  VALUES (v_uid, p_job, v_due)
  ON CONFLICT (profile_id, job_id) DO UPDATE SET tokens = EXCLUDED.tokens;

  IF v_covered > 0 THEN
    INSERT INTO public.token_ledger (profile_id, job_id, entry_type, tokens, rand, note)
    VALUES (v_uid, p_job, 'vip_cover', v_covered, 0, 'R0 (VIP)');
  END IF;

  FOR rec IN
    SELECT contractor_id FROM public.bid_ranks(p_job) WHERE rk > v_places
  LOOP
    PERFORM public.release_hold(rec.contractor_id, p_job, 'Pushed out of the top 3');
  END LOOP;

  -- Tell anyone whose place got worse, including a drop inside the top 3.
  FOR rec IN
    SELECT contractor_id, rk FROM public.bid_ranks(p_job)
  LOOP
    IF rec.contractor_id = v_uid THEN
      CONTINUE;
    END IF;
    v_old := NULLIF(v_prev_ranks ->> rec.contractor_id::text, '')::integer;
    IF v_old IS NULL OR rec.rk <= v_old THEN
      CONTINUE;
    END IF;
    IF v_old <= v_places AND rec.rk > v_places THEN
      PERFORM public.notify(rec.contractor_id, 'You dropped out of the top 3',
        'You moved from ' || public.ordinal_en(v_old) || ' to outside the top ' || v_places
        || '. Your held tokens were released. You can bid again from the lead.',
        '#/contractor/lead/' || p_job);
    ELSE
      PERFORM public.notify(rec.contractor_id, 'Your place dropped',
        'You moved from ' || public.ordinal_en(v_old) || ' to ' || public.ordinal_en(rec.rk)
        || CASE
             WHEN rec.rk <= v_places THEN '. You are still in the top ' || v_places || '.'
             ELSE '.'
           END,
        '#/contractor/lead/' || p_job);
    END IF;
  END LOOP;

  PERFORM public.notify(v_job.client_id, 'New bid',
    p_amount || CASE WHEN p_amount = 1 THEN ' token.' ELSE ' tokens.' END
    || ' Names stay hidden until bidding ends.',
    '#/client/request/' || p_job);

  SELECT rk, (SELECT count(*)::integer FROM public.bid_ranks(p_job))
  INTO v_my_rank, v_count
  FROM public.bid_ranks(p_job)
  WHERE contractor_id = v_uid;

  PERFORM public.notify(v_uid, 'Bid placed',
    'You bid ' || p_amount || CASE WHEN p_amount = 1 THEN ' token' ELSE ' tokens' END
    || '. You are ' || public.ordinal_en(COALESCE(v_my_rank, 0)) || ' of ' || COALESCE(v_count, 0)
    || '. You only pay if you finish in the top ' || v_places
    || '. If a higher bid moves you down, held tokens are released when you leave the top ' || v_places || '.',
    '#/contractor/lead/' || p_job);

  RETURN jsonb_build_object(
    'ok', true,
    'amount', p_amount,
    'due', v_due,
    'covered', v_covered,
    'min', v_min,
    'vip', v_vip
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Row level security. Writes to registrations go through the RPCs.
-- ---------------------------------------------------------------------------

ALTER TABLE public.governing_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_body_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registrations_select ON public.contractor_registrations;
CREATE POLICY registrations_select ON public.contractor_registrations
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
  );

DROP POLICY IF EXISTS job_audio_select ON public.job_audio;
CREATE POLICY job_audio_select ON public.job_audio
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_audio.job_id AND j.client_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM mq_guard.my_wins w WHERE w.job_id = job_audio.job_id)
  );

DROP POLICY IF EXISTS job_audio_insert ON public.job_audio;
CREATE POLICY job_audio_insert ON public.job_audio
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_audio_delete ON public.job_audio;
CREATE POLICY job_audio_delete ON public.job_audio
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_audio.job_id AND j.client_id = auth.uid() AND j.status = 'open'
    )
  );

DROP POLICY IF EXISTS job_plans_select ON public.job_plans;
CREATE POLICY job_plans_select ON public.job_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mq_guard.i_am_admin)
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_plans.job_id AND j.client_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM mq_guard.my_wins w WHERE w.job_id = job_plans.job_id)
  );

DROP POLICY IF EXISTS job_plans_insert ON public.job_plans;
CREATE POLICY job_plans_insert ON public.job_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS job_plans_delete ON public.job_plans;
CREATE POLICY job_plans_delete ON public.job_plans
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_plans.job_id AND j.client_id = auth.uid() AND j.status = 'open'
    )
  );

-- ---------------------------------------------------------------------------
-- Privileges. Internal helpers stay locked. The website may call the two
-- registration RPCs, and may read or add its own job files.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.registration_ok(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_registrations(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_job_audio() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_job_plan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_registration(text, text, text, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_registration(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_contractor(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_bid(uuid, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_registration(text, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_registration(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_contractor(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid(uuid, integer) TO authenticated;

REVOKE ALL ON TABLE public.governing_bodies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.trade_body_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.contractor_registrations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.job_audio FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.job_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.registration_badges FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.contractor_registrations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.job_audio TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.job_plans TO authenticated;
GRANT SELECT ON public.registration_badges TO authenticated;

-- Daily expiry flag. pg_cron may be missing or forbidden for this role.
DO $cron$
DECLARE
  v_jobid bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not installed. Registration expiry still runs when a contractor opens the app or bids.';
    RETURN;
  END IF;
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Could not create pg_cron (%). Enable it in the dashboard. Expiry still runs on sign-in and on a bid.', SQLERRM;
      RETURN;
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not create pg_cron (%).', SQLERRM;
      RETURN;
  END;
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron tables are not visible. Expiry still runs on sign-in and on a bid.';
    RETURN;
  END IF;
  BEGIN
    FOR v_jobid IN SELECT jobid FROM cron.job WHERE jobname = 'mq_expire_registrations'
    LOOP
      PERFORM cron.unschedule(v_jobid);
    END LOOP;
    PERFORM cron.schedule(
      'mq_expire_registrations',
      '15 6 * * *',
      'SELECT public.expire_registrations(NULL)'
    );
    RAISE NOTICE 'Scheduled mq_expire_registrations daily';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Could not schedule mq_expire_registrations (%).', SQLERRM;
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron was not scheduled (%).', SQLERRM;
  END;
END
$cron$;

-- Private buckets for voice notes and plans. Skipped when Storage is absent.
DO $storage$
BEGIN
  IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage schema not present — create private buckets job-audio and job-plans in the dashboard';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES
      ('job-audio', 'job-audio', false, 4194304, ARRAY['audio/webm','audio/mp4','audio/mpeg','audio/aac','audio/wav','audio/x-wav','audio/ogg','audio/x-m4a','audio/mp3']),
      ('job-plans', 'job-plans', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/gif'])
    ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;
  EXCEPTION
    WHEN undefined_column THEN
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('job-audio', 'job-audio', false), ('job-plans', 'job-plans', false)
      ON CONFLICT (id) DO UPDATE SET public = false;
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Could not create storage buckets (%). Create private buckets job-audio and job-plans in the dashboard.', SQLERRM;
      RETURN;
  END;

  BEGIN
    DROP POLICY IF EXISTS mq_job_audio_read ON storage.objects;
    CREATE POLICY mq_job_audio_read ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'job-audio' AND (
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

    DROP POLICY IF EXISTS mq_job_audio_insert ON storage.objects;
    CREATE POLICY mq_job_audio_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'job-audio'
        AND EXISTS (
          SELECT 1 FROM public.job_requests j
          WHERE j.id::text = (storage.foldername(name))[1] AND j.client_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS mq_job_audio_delete ON storage.objects;
    CREATE POLICY mq_job_audio_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'job-audio'
        AND EXISTS (
          SELECT 1 FROM public.job_requests j
          WHERE j.id::text = (storage.foldername(name))[1]
            AND j.client_id = auth.uid()
            AND j.status = 'open'
        )
      );

    DROP POLICY IF EXISTS mq_job_plans_read ON storage.objects;
    CREATE POLICY mq_job_plans_read ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'job-plans' AND (
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

    DROP POLICY IF EXISTS mq_job_plans_insert ON storage.objects;
    CREATE POLICY mq_job_plans_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'job-plans'
        AND EXISTS (
          SELECT 1 FROM public.job_requests j
          WHERE j.id::text = (storage.foldername(name))[1] AND j.client_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS mq_job_plans_delete ON storage.objects;
    CREATE POLICY mq_job_plans_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'job-plans'
        AND EXISTS (
          SELECT 1 FROM public.job_requests j
          WHERE j.id::text = (storage.foldername(name))[1]
            AND j.client_id = auth.uid()
            AND j.status = 'open'
        )
      );
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Storage policies were not created (%).', SQLERRM;
    WHEN OTHERS THEN
      RAISE NOTICE 'Storage policies were not created (%). Create private buckets job-audio and job-plans, then re-run this script.', SQLERRM;
  END;
END
$storage$;
