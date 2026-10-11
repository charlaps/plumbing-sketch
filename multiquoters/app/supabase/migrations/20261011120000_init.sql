-- Multiquoters schema, row level security, and money functions.
-- Apply in the Supabase SQL editor (or via psql) as a superuser.
-- Local tests create a stand-in auth schema first. Do not create auth.users here.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

INSERT INTO public.app_settings (key, value) VALUES
  ('token_rand', '20'),
  ('vip_free_tokens', '5'),
  ('auction_hours', '12'),
  ('places', '3'),
  ('early_alert_minutes', '15'),
  ('max_extensions', '2'),
  ('vip_price', '{"yearly":9999,"monthly":999}');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('client', 'contractor', 'admin')),
  full_name text,
  business_name text,
  trades text[] NOT NULL DEFAULT '{}',
  areas text[] NOT NULL DEFAULT '{}',
  vat_registered boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  verification_docs jsonb NOT NULL DEFAULT '[]'::jsonb,
  vip_until timestamptz,
  phone text,
  user_code text NOT NULL UNIQUE,
  token_available integer NOT NULL DEFAULT 0 CHECK (token_available >= 0),
  token_held integer NOT NULL DEFAULT 0 CHECK (token_held >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.job_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles (id),
  trade text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  suburb text NOT NULL,
  area text NOT NULL,
  when_needed text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'quoting', 'accepted', 'closed', 'flagged', 'cancelled')),
  auction_ends_at timestamptz NOT NULL,
  extensions integer NOT NULL DEFAULT 0,
  flagged boolean NOT NULL DEFAULT false,
  flag_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_requests_auction_idx ON public.job_requests (status, auction_ends_at);

CREATE TABLE public.request_private (
  job_id uuid PRIMARY KEY REFERENCES public.job_requests (id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  phone text NOT NULL,
  private_note text
);

CREATE TABLE public.request_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles (id),
  amount integer NOT NULL CHECK (amount >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bids_job_idx ON public.bids (job_id, contractor_id);

CREATE TABLE public.token_holds (
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  tokens integer NOT NULL CHECK (tokens >= 0),
  PRIMARY KEY (profile_id, job_id)
);

CREATE TABLE public.auction_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles (id),
  place integer NOT NULL CHECK (place >= 1),
  bid_amount integer NOT NULL,
  tokens_spent integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, contractor_id)
);

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles (id),
  materials_rand integer NOT NULL DEFAULT 0 CHECK (materials_rand >= 0),
  labour_rand integer NOT NULL DEFAULT 0 CHECK (labour_rand >= 0),
  callout_rand integer NOT NULL DEFAULT 0 CHECK (callout_rand >= 0),
  included text,
  excluded text,
  vat_registered boolean NOT NULL DEFAULT false,
  timeline text,
  valid_until date,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'not_selected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, contractor_id)
);

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  label text NOT NULL,
  rand integer NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('material', 'labour', 'callout', 'other'))
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.token_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  job_id uuid REFERENCES public.job_requests (id),
  entry_type text NOT NULL CHECK (entry_type IN ('purchase', 'hold', 'release', 'spend', 'vip_cover', 'grant')),
  tokens integer NOT NULL CHECK (tokens >= 0),
  rand integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX token_ledger_profile_idx ON public.token_ledger (profile_id, created_at DESC);

CREATE TABLE public.vip_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  price_rand integer NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_requests (id),
  client_id uuid NOT NULL REFERENCES public.profiles (id),
  contractor_id uuid NOT NULL REFERENCES public.profiles (id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, contractor_id)
);

CREATE TABLE public.audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  href text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_profile_idx ON public.notifications (profile_id, created_at DESC);

CREATE TABLE public.lead_notifications (
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL,
  PRIMARY KEY (job_id, profile_id, kind)
);

-- Amounts only. No contractor id, so live updates stay anonymised.
CREATE TABLE public.bid_feed (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bid_feed_job_idx ON public.bid_feed (job_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.setting_int(p_key text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN jsonb_typeof(value) = 'number' THEN (trim(both '"' from value::text))::integer
    ELSE NULL
  END
  FROM public.app_settings
  WHERE key = p_key;
$$;

CREATE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE FUNCTION public.is_winner(p_job uuid, p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_results
    WHERE job_id = p_job AND contractor_id = p_user
  );
$$;

CREATE FUNCTION public.contractor_can_see_job(p_job uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_requests j
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE j.id = p_job
      AND p.role = 'contractor'
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
      )
  );
$$;

CREATE FUNCTION public.can_review(p_job uuid, p_contractor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quotes q
    JOIN public.job_requests j ON j.id = q.job_id
    WHERE q.job_id = p_job
      AND q.contractor_id = p_contractor
      AND q.status = 'accepted'
      AND j.client_id = auth.uid()
      AND j.status = 'accepted'
  );
$$;

-- Highest bid per contractor. Earlier timestamp wins a tie.
CREATE FUNCTION public.bid_ranks(p_job uuid)
RETURNS TABLE (contractor_id uuid, amount integer, created_at timestamptz, rk integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT contractor_id, amount, created_at,
         row_number() OVER (ORDER BY amount DESC, created_at ASC)::integer AS rk
  FROM (
    SELECT DISTINCT ON (contractor_id) contractor_id, amount, created_at
    FROM public.bids
    WHERE job_id = p_job
    ORDER BY contractor_id, amount DESC, created_at ASC
  ) best;
$$;

CREATE FUNCTION public.protect_profile() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Direct API updates run as authenticated/anon. Definer RPCs run as the owner.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.vip_until IS DISTINCT FROM OLD.vip_until
     OR NEW.token_available IS DISTINCT FROM OLD.token_available
     OR NEW.token_held IS DISTINCT FROM OLD.token_held
     OR NEW.user_code IS DISTINCT FROM OLD.user_code
     OR NEW.verification_docs IS DISTINCT FROM OLD.verification_docs
  THEN
    RAISE EXCEPTION 'protected profile field';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile();

CREATE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chosen text;
BEGIN
  chosen := COALESCE(NEW.raw_user_meta_data ->> 'role', 'client');
  IF chosen NOT IN ('client', 'contractor') THEN
    chosen := 'client';
  END IF;
  INSERT INTO public.profiles (id, role, full_name, phone, user_code)
  VALUES (
    NEW.id,
    chosen,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(COALESCE(NEW.email, 'member'), '@', 1)),
    NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
    'MQ-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE FUNCTION public.audit_write(p_action text, p_entity text, p_entity_id uuid, p_detail jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit (actor_id, action, entity, entity_id, detail)
  VALUES (auth.uid(), p_action, p_entity, p_entity_id, p_detail);
END;
$$;

CREATE FUNCTION public.release_hold(p_profile uuid, p_job uuid, p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tokens integer;
  v_rand integer;
BEGIN
  SELECT tokens INTO v_tokens
  FROM public.token_holds
  WHERE profile_id = p_profile AND job_id = p_job
  FOR UPDATE;
  IF v_tokens IS NULL THEN
    RETURN;
  END IF;
  v_rand := COALESCE(public.setting_int('token_rand'), 20);
  IF v_tokens > 0 THEN
    UPDATE public.profiles
    SET token_available = token_available + v_tokens,
        token_held = token_held - v_tokens,
        updated_at = now()
    WHERE id = p_profile;
    INSERT INTO public.token_ledger (profile_id, job_id, entry_type, tokens, rand, note)
    VALUES (p_profile, p_job, 'release', v_tokens, v_tokens * v_rand, p_note);
  END IF;
  DELETE FROM public.token_holds WHERE profile_id = p_profile AND job_id = p_job;
END;
$$;

CREATE FUNCTION public.spend_hold(p_profile uuid, p_job uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tokens integer;
  v_rand integer;
BEGIN
  SELECT tokens INTO v_tokens
  FROM public.token_holds
  WHERE profile_id = p_profile AND job_id = p_job
  FOR UPDATE;
  IF v_tokens IS NULL THEN
    RETURN 0;
  END IF;
  v_rand := COALESCE(public.setting_int('token_rand'), 20);
  IF v_tokens > 0 THEN
    UPDATE public.profiles
    SET token_held = token_held - v_tokens,
        updated_at = now()
    WHERE id = p_profile;
    INSERT INTO public.token_ledger (profile_id, job_id, entry_type, tokens, rand, note)
    VALUES (p_profile, p_job, 'spend', v_tokens, v_tokens * v_rand, 'Won a place');
  END IF;
  DELETE FROM public.token_holds WHERE profile_id = p_profile AND job_id = p_job;
  RETURN v_tokens;
END;
$$;

CREATE FUNCTION public.notify(p_profile uuid, p_title text, p_body text, p_href text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (profile_id, title, body, href)
  VALUES (p_profile, p_title, p_body, p_href);
END;
$$;

-- ---------------------------------------------------------------------------
-- Auction close (idempotent)
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.close_auction(p_job uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job public.job_requests%ROWTYPE;
  v_places integer;
  v_hours integer;
  v_max_ext integer;
  rec record;
  v_place integer := 0;
  v_spent integer;
BEGIN
  SELECT * INTO v_job FROM public.job_requests WHERE id = p_job FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job not found');
  END IF;
  IF v_job.status <> 'open' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', v_job.status);
  END IF;

  IF v_job.auction_ends_at > now() THEN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'auction still open');
    END IF;
  END IF;

  IF (SELECT count(DISTINCT contractor_id) FROM public.bids WHERE job_id = p_job) = 0 THEN
    v_max_ext := COALESCE(public.setting_int('max_extensions'), 2);
    v_hours := COALESCE(public.setting_int('auction_hours'), 12);
    IF v_job.extensions < v_max_ext THEN
      UPDATE public.job_requests
      SET extensions = extensions + 1,
          auction_ends_at = now() + make_interval(hours => v_hours)
      WHERE id = p_job;
      PERFORM public.audit_write('extend_auction', 'job_requests', p_job,
        jsonb_build_object('extensions', v_job.extensions + 1));
      RETURN jsonb_build_object('ok', true, 'extended', true);
    END IF;
    UPDATE public.job_requests SET status = 'closed' WHERE id = p_job;
    PERFORM public.notify(v_job.client_id, 'Auction closed',
      'No contractors bid. You can post the job again.', '#/client/request/' || p_job);
    PERFORM public.audit_write('close_auction', 'job_requests', p_job, '{"winners":0}'::jsonb);
    RETURN jsonb_build_object('ok', true, 'closed', true, 'winners', 0);
  END IF;

  v_places := COALESCE(public.setting_int('places'), 3);

  PERFORM p.id
  FROM public.profiles p
  WHERE p.id IN (SELECT DISTINCT b.contractor_id FROM public.bids b WHERE b.job_id = p_job)
  ORDER BY p.id
  FOR UPDATE;

  FOR rec IN
    SELECT contractor_id, amount, rk
    FROM public.bid_ranks(p_job)
    WHERE rk <= v_places
    ORDER BY rk
  LOOP
    v_place := v_place + 1;
    v_spent := public.spend_hold(rec.contractor_id, p_job);
    INSERT INTO public.auction_results (job_id, contractor_id, place, bid_amount, tokens_spent)
    VALUES (p_job, rec.contractor_id, v_place, rec.amount, v_spent);
    PERFORM public.notify(rec.contractor_id, 'You won a place',
      'You finished in the top bidders. The client contact is now unlocked.',
      '#/contractor/lead/' || p_job);
  END LOOP;

  FOR rec IN
    SELECT contractor_id FROM public.bid_ranks(p_job) WHERE rk > v_places
  LOOP
    PERFORM public.release_hold(rec.contractor_id, p_job, 'Did not win a place');
    PERFORM public.notify(rec.contractor_id, 'Auction ended',
      'You did not finish in the top places. Held tokens were released.',
      '#/contractor/lead/' || p_job);
  END LOOP;

  UPDATE public.job_requests SET status = 'matched' WHERE id = p_job;
  PERFORM public.notify(v_job.client_id, 'Contractors chosen',
    'Your auction has closed. You can compare quotes as they come in.',
    '#/client/request/' || p_job);
  PERFORM public.audit_write('close_auction', 'job_requests', p_job,
    jsonb_build_object('winners', v_place));
  RETURN jsonb_build_object('ok', true, 'winners', v_place);
END;
$$;

CREATE FUNCTION public.close_expired_auctions() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT id
    FROM public.job_requests
    WHERE status = 'open' AND auction_ends_at <= now()
    ORDER BY id
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.close_auction(rec.id);
    n := n + 1;
  END LOOP;
  PERFORM public.notify_due_leads();
  RETURN n;
END;
$$;

-- ---------------------------------------------------------------------------
-- Bids
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.place_bid(p_job uuid, p_amount integer) RETURNS jsonb
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
    IF rec.contractor_id = ANY (v_prev_top) THEN
      PERFORM public.notify(rec.contractor_id, 'You were outbid',
        'A higher bid pushed you out of the top 3. Held tokens were released.',
        '#/contractor/lead/' || p_job);
    END IF;
  END LOOP;

  PERFORM public.notify(v_job.client_id, 'New bid',
    'A contractor bid on your job. Bids stay anonymous until the auction ends.',
    '#/client/request/' || p_job);

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

CREATE FUNCTION public.preview_bid(p_job uuid, p_amount integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_me public.profiles%ROWTYPE;
  v_places integer;
  v_free integer;
  v_rand integer;
  v_count integer;
  v_own integer;
  v_my_rank integer;
  v_third integer;
  v_min integer;
  v_due integer;
  v_covered integer;
  v_vip boolean;
  v_prev integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  v_places := COALESCE(public.setting_int('places'), 3);
  v_free := COALESCE(public.setting_int('vip_free_tokens'), 5);
  v_rand := COALESCE(public.setting_int('token_rand'), 20);
  SELECT * INTO v_me FROM public.profiles WHERE id = v_uid;
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
  v_vip := v_me.vip_until IS NOT NULL AND v_me.vip_until > now();
  IF p_amount IS NULL THEN
    p_amount := v_min;
  END IF;
  IF v_vip THEN
    v_due := GREATEST(0, p_amount - v_free);
    v_covered := LEAST(p_amount, v_free);
  ELSE
    v_due := p_amount;
    v_covered := 0;
  END IF;
  SELECT tokens INTO v_prev FROM public.token_holds WHERE profile_id = v_uid AND job_id = p_job;
  RETURN jsonb_build_object(
    'min', v_min,
    'amount', p_amount,
    'due', v_due,
    'covered', v_covered,
    'vip', v_vip,
    'token_rand', v_rand,
    'extra', v_due - COALESCE(v_prev, 0),
    'third', v_third,
    'in_top', v_my_rank IS NOT NULL AND v_my_rank <= v_places
  );
END;
$$;

CREATE FUNCTION public.bid_board(p_job uuid)
RETURNS TABLE (label text, amount integer, is_you boolean, vip boolean, place integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed boolean;
BEGIN
  v_allowed := public.is_admin()
    OR EXISTS (SELECT 1 FROM public.job_requests j WHERE j.id = p_job AND j.client_id = v_uid)
    OR public.contractor_can_see_job(p_job);
  IF NOT v_allowed THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    CASE
      WHEN r.contractor_id = v_uid THEN 'You'
      ELSE 'Contractor ' || chr(64 + r.rk::integer)
    END,
    r.amount,
    r.contractor_id = v_uid,
    (p.vip_until IS NOT NULL AND p.vip_until > now()),
    r.rk
  FROM public.bid_ranks(p_job) r
  JOIN public.profiles p ON p.id = r.contractor_id
  WHERE r.rk <= COALESCE(public.setting_int('places'), 3)
     OR r.contractor_id = v_uid
  ORDER BY r.rk;
END;
$$;

-- ---------------------------------------------------------------------------
-- Jobs, quotes, messages, reviews
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.create_job(
  p_trade text,
  p_title text,
  p_description text,
  p_suburb text,
  p_area text,
  p_when text,
  p_contact_name text,
  p_phone text,
  p_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_id uuid;
  v_hours integer;
  rec record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'client' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'clients only');
  END IF;
  IF COALESCE(btrim(p_trade), '') = '' OR COALESCE(btrim(p_title), '') = ''
     OR COALESCE(btrim(p_suburb), '') = '' OR COALESCE(btrim(p_area), '') = ''
     OR COALESCE(btrim(p_contact_name), '') = '' OR length(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')) < 10
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing details');
  END IF;
  v_hours := COALESCE(public.setting_int('auction_hours'), 12);
  INSERT INTO public.job_requests (client_id, trade, title, description, suburb, area, when_needed, auction_ends_at)
  VALUES (v_uid, btrim(p_trade), btrim(p_title), COALESCE(p_description, ''), btrim(p_suburb), btrim(p_area), NULLIF(btrim(COALESCE(p_when, '')), ''), now() + make_interval(hours => v_hours))
  RETURNING id INTO v_id;
  INSERT INTO public.request_private (job_id, contact_name, phone, private_note)
  VALUES (v_id, btrim(p_contact_name), btrim(p_phone), NULLIF(btrim(COALESCE(p_note, '')), ''));

  FOR rec IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.role = 'contractor'
      AND p.verified
      AND p.vip_until IS NOT NULL
      AND p.vip_until > now()
      AND p_trade = ANY (p.trades)
      AND (p_area = ANY (p.areas) OR p_suburb = ANY (p.areas))
  LOOP
    INSERT INTO public.lead_notifications (job_id, profile_id, kind)
    VALUES (v_id, rec.id, 'alert')
    ON CONFLICT DO NOTHING;
    PERFORM public.notify(rec.id, 'VIP early access',
      p_title || ' in ' || p_suburb || ' is open. VIP alerts go out 15 minutes earlier.',
      '#/contractor/lead/' || v_id);
  END LOOP;

  PERFORM public.audit_write('create_job', 'job_requests', v_id, jsonb_build_object('trade', p_trade, 'area', p_area));
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE FUNCTION public.notify_due_leads() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer := 0;
  v_mins integer;
  rec record;
BEGIN
  v_mins := COALESCE(public.setting_int('early_alert_minutes'), 15);
  FOR rec IN
    SELECT j.id AS job_id, p.id AS profile_id, j.title, j.suburb
    FROM public.job_requests j
    JOIN public.profiles p
      ON p.role = 'contractor'
     AND p.verified
     AND (p.vip_until IS NULL OR p.vip_until <= now())
     AND j.trade = ANY (p.trades)
     AND (j.area = ANY (p.areas) OR j.suburb = ANY (p.areas))
    WHERE j.status = 'open'
      AND NOT j.flagged
      AND j.created_at <= now() - make_interval(mins => v_mins)
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_notifications ln
        WHERE ln.job_id = j.id AND ln.profile_id = p.id AND ln.kind = 'alert'
      )
  LOOP
    INSERT INTO public.lead_notifications (job_id, profile_id, kind)
    VALUES (rec.job_id, rec.profile_id, 'alert')
    ON CONFLICT DO NOTHING;
    PERFORM public.notify(rec.profile_id, 'New lead',
      rec.title || ' in ' || rec.suburb,
      '#/contractor/lead/' || rec.job_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

CREATE FUNCTION public.save_quote(
  p_job uuid,
  p_materials integer,
  p_labour integer,
  p_callout integer,
  p_included text,
  p_excluded text,
  p_timeline text,
  p_valid_days integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_quote uuid;
  v_vat boolean;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.is_winner(p_job, v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'only winners can quote');
  END IF;
  SELECT status INTO v_status FROM public.job_requests WHERE id = p_job;
  IF v_status NOT IN ('matched', 'quoting') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quotes are closed');
  END IF;
  IF EXISTS (SELECT 1 FROM public.quotes WHERE job_id = p_job AND contractor_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'you already sent a quote');
  END IF;
  IF COALESCE(p_materials, 0) < 0 OR COALESCE(p_labour, 0) < 0 OR COALESCE(p_callout, 0) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amounts must be zero or more');
  END IF;
  SELECT vat_registered INTO v_vat FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.quotes (
    job_id, contractor_id, materials_rand, labour_rand, callout_rand,
    included, excluded, vat_registered, timeline, valid_until
  ) VALUES (
    p_job, v_uid, COALESCE(p_materials, 0), COALESCE(p_labour, 0), COALESCE(p_callout, 0),
    NULLIF(btrim(COALESCE(p_included, '')), ''),
    NULLIF(btrim(COALESCE(p_excluded, '')), ''),
    COALESCE(v_vat, false),
    NULLIF(btrim(COALESCE(p_timeline, '')), ''),
    CURRENT_DATE + COALESCE(p_valid_days, 14)
  ) RETURNING id INTO v_quote;
  INSERT INTO public.quote_items (quote_id, label, rand, kind) VALUES
    (v_quote, 'Materials', COALESCE(p_materials, 0), 'material'),
    (v_quote, 'Labour', COALESCE(p_labour, 0), 'labour'),
    (v_quote, 'Call-out', COALESCE(p_callout, 0), 'callout');
  UPDATE public.job_requests SET status = 'quoting' WHERE id = p_job AND status = 'matched';
  PERFORM public.notify(
    (SELECT client_id FROM public.job_requests WHERE id = p_job),
    'Quote received',
    'A winning contractor sent a quote.',
    '#/client/request/' || p_job
  );
  RETURN jsonb_build_object('ok', true, 'id', v_quote);
END;
$$;

CREATE FUNCTION public.accept_quote(p_quote uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_job uuid;
  v_contractor uuid;
  v_client uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT q.job_id, q.contractor_id, j.client_id
  INTO v_job, v_contractor, v_client
  FROM public.quotes q
  JOIN public.job_requests j ON j.id = q.job_id
  WHERE q.id = p_quote
  FOR UPDATE OF q;
  IF v_job IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote not found');
  END IF;
  IF v_client <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not your request');
  END IF;
  UPDATE public.quotes SET status = 'not_selected' WHERE job_id = v_job AND id <> p_quote AND status <> 'accepted';
  UPDATE public.quotes SET status = 'accepted' WHERE id = p_quote;
  UPDATE public.job_requests SET status = 'accepted' WHERE id = v_job;
  PERFORM public.notify(v_contractor, 'Quote accepted',
    'The client accepted your quote. You can message them here.',
    '#/contractor/lead/' || v_job);
  PERFORM public.audit_write('accept_quote', 'quotes', p_quote, jsonb_build_object('job', v_job));
  RETURN jsonb_build_object('ok', true, 'job_id', v_job);
END;
$$;

CREATE FUNCTION public.send_message(p_job uuid, p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_client uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF COALESCE(btrim(p_body), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty message');
  END IF;
  SELECT status, client_id INTO v_status, v_client FROM public.job_requests WHERE id = p_job;
  IF v_status NOT IN ('matched', 'quoting', 'accepted') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'messaging opens after the auction');
  END IF;
  IF v_uid <> v_client AND NOT public.is_winner(p_job, v_uid) AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not allowed');
  END IF;
  INSERT INTO public.messages (job_id, sender_id, body) VALUES (p_job, v_uid, btrim(p_body));
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.submit_review(p_job uuid, p_contractor uuid, p_rating integer, p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rating must be 1 to 5');
  END IF;
  IF NOT public.can_review(p_job, p_contractor) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'you can review only an accepted quote');
  END IF;
  INSERT INTO public.reviews (job_id, client_id, contractor_id, rating, body)
  VALUES (p_job, v_uid, p_contractor, p_rating, NULLIF(btrim(COALESCE(p_body, '')), ''));
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'already reviewed');
END;
$$;

-- ---------------------------------------------------------------------------
-- Profile and admin
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.my_profile() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb;
BEGIN
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
    'token_held', token_held
  ) INTO v
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN v;
END;
$$;

CREATE FUNCTION public.public_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) FROM public.app_settings;
$$;

CREATE FUNCTION public.public_contractor(p_code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'business_name', business_name,
    'full_name', full_name,
    'trades', to_jsonb(trades),
    'areas', to_jsonb(areas),
    'vat_registered', vat_registered,
    'verified', verified,
    'vip', (vip_until IS NOT NULL AND vip_until > now()),
    'user_code', user_code
  )
  FROM public.profiles
  WHERE user_code = upper(btrim(p_code)) AND role = 'contractor';
$$;

CREATE FUNCTION public.update_profile(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.profiles SET
    full_name = COALESCE(NULLIF(btrim(p ->> 'full_name'), ''), full_name),
    business_name = NULLIF(btrim(COALESCE(p ->> 'business_name', business_name)), ''),
    trades = CASE
      WHEN p ? 'trades' THEN ARRAY(SELECT jsonb_array_elements_text(p -> 'trades'))
      ELSE trades
    END,
    areas = CASE
      WHEN p ? 'areas' THEN ARRAY(SELECT jsonb_array_elements_text(p -> 'areas'))
      ELSE areas
    END,
    vat_registered = CASE WHEN p ? 'vat_registered' THEN (p ->> 'vat_registered')::boolean ELSE vat_registered END,
    phone = COALESCE(NULLIF(btrim(p ->> 'phone'), ''), phone),
    updated_at = now()
  WHERE id = v_uid;
  RETURN public.my_profile();
END;
$$;

CREATE FUNCTION public.add_verification_doc(p_path text, p_kind text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF COALESCE(p_path, '') = '' OR split_part(p_path, '/', 1) <> v_uid::text THEN
    RETURN jsonb_build_object('ok', false, 'error', 'file must be in your folder');
  END IF;
  IF COALESCE(p_kind, '') NOT IN ('id', 'trade_cert') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown document');
  END IF;
  UPDATE public.profiles
  SET verification_docs = verification_docs || jsonb_build_array(jsonb_build_object(
        'path', p_path, 'kind', p_kind, 'at', now()
      )),
      updated_at = now()
  WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.unlocked_contacts(p_job uuid)
RETURNS TABLE (who text, name text, phone text, business_name text, person_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF public.is_admin() OR EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = p_job AND j.client_id = auth.uid()
  ) THEN
    IF EXISTS (SELECT 1 FROM public.auction_results ar WHERE ar.job_id = p_job) OR public.is_admin() THEN
      RETURN QUERY
      SELECT 'contractor'::text, p.full_name, p.phone, p.business_name, p.id
      FROM public.auction_results ar
      JOIN public.profiles p ON p.id = ar.contractor_id
      WHERE ar.job_id = p_job
      ORDER BY ar.place;
      IF NOT public.is_admin() THEN
        RETURN;
      END IF;
    END IF;
  END IF;
  IF public.is_winner(p_job, auth.uid()) OR public.is_admin() THEN
    RETURN QUERY
    SELECT 'client'::text, rp.contact_name, rp.phone, NULL::text, j.client_id
    FROM public.request_private rp
    JOIN public.job_requests j ON j.id = rp.job_id
    WHERE rp.job_id = p_job;
  END IF;
END;
$$;

CREATE FUNCTION public.grant_tokens(p_profile uuid, p_tokens integer, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rand integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_tokens IS NULL OR p_tokens <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tokens must be positive');
  END IF;
  PERFORM id FROM public.profiles WHERE id = p_profile FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile not found');
  END IF;
  v_rand := COALESCE(public.setting_int('token_rand'), 20);
  UPDATE public.profiles
  SET token_available = token_available + p_tokens, updated_at = now()
  WHERE id = p_profile;
  INSERT INTO public.token_ledger (profile_id, entry_type, tokens, rand, note)
  VALUES (p_profile, 'grant', p_tokens, p_tokens * v_rand, COALESCE(NULLIF(btrim(p_note), ''), 'EFT credit'));
  PERFORM public.audit_write('grant_tokens', 'profiles', p_profile, jsonb_build_object('tokens', p_tokens));
  PERFORM public.notify(p_profile, 'Tokens credited',
    p_tokens || ' tokens were added to your wallet.', '#/contractor/wallet');
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.mark_vip(p_profile uuid, p_plan text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_price integer;
  v_end timestamptz;
  v_start timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_plan NOT IN ('monthly', 'yearly') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan must be monthly or yearly');
  END IF;
  SELECT CASE p_plan
    WHEN 'yearly' THEN (value ->> 'yearly')::integer
    ELSE (value ->> 'monthly')::integer
  END INTO v_price
  FROM public.app_settings WHERE key = 'vip_price';
  SELECT GREATEST(COALESCE(vip_until, now()), now()) INTO v_start
  FROM public.profiles WHERE id = p_profile FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile not found');
  END IF;
  v_end := v_start + CASE WHEN p_plan = 'yearly' THEN interval '1 year' ELSE interval '1 month' END;
  UPDATE public.profiles SET vip_until = v_end, updated_at = now() WHERE id = p_profile;
  INSERT INTO public.vip_memberships (profile_id, plan, price_rand, starts_at, ends_at, source)
  VALUES (p_profile, p_plan, COALESCE(v_price, 0), now(), v_end, 'admin_eft');
  PERFORM public.audit_write('mark_vip', 'profiles', p_profile, jsonb_build_object('plan', p_plan, 'until', v_end));
  PERFORM public.notify(p_profile, 'VIP membership',
    'You are a VIP member until ' || to_char(v_end, 'YYYY-MM-DD') || '.', '#/contractor/vip');
  RETURN jsonb_build_object('ok', true, 'vip_until', v_end);
END;
$$;

CREATE FUNCTION public.verify_contractor(p_profile uuid, p_verified boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.profiles SET verified = COALESCE(p_verified, false), updated_at = now()
  WHERE id = p_profile AND role = 'contractor';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contractor not found');
  END IF;
  PERFORM public.audit_write('verify_contractor', 'profiles', p_profile, jsonb_build_object('verified', p_verified));
  PERFORM public.notify(p_profile,
    CASE WHEN p_verified THEN 'You are verified' ELSE 'Verification removed' END,
    CASE WHEN p_verified THEN 'You can bid on leads that match your trades and areas.' ELSE 'An admin removed your verified badge.' END,
    '#/contractor/profile');
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.flag_job(p_job uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  PERFORM id FROM public.job_requests WHERE id = p_job FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job not found');
  END IF;
  PERFORM p.id
  FROM public.profiles p
  WHERE p.id IN (SELECT h.profile_id FROM public.token_holds h WHERE h.job_id = p_job)
  ORDER BY p.id
  FOR UPDATE;
  FOR rec IN SELECT h.profile_id FROM public.token_holds h WHERE h.job_id = p_job
  LOOP
    PERFORM public.release_hold(rec.profile_id, p_job, 'Lead flagged');
  END LOOP;
  UPDATE public.job_requests
  SET flagged = true,
      status = 'flagged',
      flag_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
  WHERE id = p_job;
  PERFORM public.audit_write('flag_job', 'job_requests', p_job, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.admin_snapshot() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN jsonb_build_object(
    'contractors', COALESCE((
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.created_at DESC)
      FROM (
        SELECT p.id, p.full_name, p.business_name, p.verified, p.trades, p.areas,
               p.token_available, p.token_held, p.vip_until, p.user_code, p.phone,
               p.verification_docs, u.email, p.created_at
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

CREATE FUNCTION public.mark_notifications_read() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.notifications SET read_at = now()
  WHERE profile_id = auth.uid() AND read_at IS NULL;
END;
$$;

-- Safe contractor card. security_invoker false: owner reads past RLS, columns are non-sensitive.
CREATE VIEW public.contractor_cards WITH (security_invoker = false) AS
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
WHERE role = 'contractor';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY jobs_select ON public.job_requests
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR public.is_admin()
    OR public.contractor_can_see_job(id)
  );

CREATE POLICY private_select ON public.request_private
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
  );

CREATE POLICY photos_select ON public.request_photos
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
    OR public.is_winner(job_id, auth.uid())
  );

CREATE POLICY photos_insert ON public.request_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
  );

CREATE POLICY bids_select ON public.bids
  FOR SELECT TO authenticated
  USING (contractor_id = auth.uid() OR public.is_admin());

CREATE POLICY results_select ON public.auction_results
  FOR SELECT TO authenticated
  USING (
    contractor_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
  );

CREATE POLICY quotes_select ON public.quotes
  FOR SELECT TO authenticated
  USING (
    contractor_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
  );

CREATE POLICY quote_items_select ON public.quote_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quotes q
      JOIN public.job_requests j ON j.id = q.job_id
      WHERE q.id = quote_id
        AND (q.contractor_id = auth.uid() OR j.client_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
    OR public.is_winner(job_id, auth.uid())
  );

CREATE POLICY ledger_select ON public.token_ledger
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY vip_select ON public.vip_memberships
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY reviews_select ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY audit_select ON public.audit
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY bid_feed_select ON public.bid_feed
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
      WHERE j.id = job_id AND j.client_id = auth.uid()
    )
    OR public.contractor_can_see_job(job_id)
  );

-- ---------------------------------------------------------------------------
-- Grants. Money tables are not writable through the API.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.setting_int(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bid_ranks(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_hold(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.spend_hold(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_write(text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_due_leads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_expired_auctions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_winner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contractor_can_see_job(uuid) FROM PUBLIC;

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
GRANT SELECT ON public.contractor_cards TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.public_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_contractor(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_verification_doc(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_job(text, text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_bid(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bid_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_auction(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlocked_contacts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_quote(uuid, integer, integer, integer, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_quote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_tokens(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_vip(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_contractor(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flag_job(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_winner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contractor_can_see_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_review(uuid, uuid) TO authenticated;

-- Storage: private buckets. Skipped when this database has no Storage API (local Postgres).
DO $storage$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    RAISE NOTICE 'storage schema not present — create the job-photos and verification buckets in the Supabase dashboard';
    RETURN;
  END IF;
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('job-photos', 'job-photos', false), ('verification', 'verification', false)
  ON CONFLICT (id) DO NOTHING;

  EXECUTE $p$
    CREATE POLICY mq_job_photos_read ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'job-photos' AND (
        public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.job_requests j
          WHERE j.id::text = (storage.foldername(name))[1] AND j.client_id = auth.uid()
        )
        OR public.is_winner(((storage.foldername(name))[1])::uuid, auth.uid())
      )
    )
  $p$;
  EXECUTE $p$
    CREATE POLICY mq_job_photos_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'job-photos'
      AND EXISTS (
        SELECT 1 FROM public.job_requests j
        WHERE j.id::text = (storage.foldername(name))[1] AND j.client_id = auth.uid()
      )
    )
  $p$;
  EXECUTE $p$
    CREATE POLICY mq_verification_read ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'verification' AND (
        public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  $p$;
  EXECUTE $p$
    CREATE POLICY mq_verification_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'verification' AND (storage.foldername(name))[1] = auth.uid()::text
    )
  $p$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage policies were not created (%). Create private buckets job-photos and verification in the dashboard, then re-run this migration section.', SQLERRM;
END $storage$;

-- Live bid and notification events, when Supabase Realtime is installed.
DO $pub$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.bid_feed;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.job_requests;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'realtime publication skipped (%)', SQLERRM;
END $pub$;
