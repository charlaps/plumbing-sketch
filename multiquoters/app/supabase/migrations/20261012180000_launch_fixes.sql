-- Launch fixes from the 12 Oct 2026 walkthrough.
-- Apply after 20261011190000_security_fixes.sql. Safe to run again.
-- Hosted Supabase runs this as postgres, which is not a superuser.
--
-- Adds:
--   * stable anonymised bid labels (Contractor A stays Contractor A)
--   * quote line items with quantity and unit price (quote_items already exists)
--   * client contact hidden from plumbers who were not chosen, after acceptance
--   * a terms-consent timestamp on the profile
--   * one review per client per job
-- Money movement is unchanged: 1 token = R20, opens at 1, top 3 pay their own
-- bids, outbid holds are released, VIP covers up to 5 tokens, admins cannot bid.

-- ---------------------------------------------------------------------------
-- Consent, line-item columns, one review.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS other_rand integer NOT NULL DEFAULT 0;

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS qty numeric(12,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_rand integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotes_other_rand_nonneg' AND conrelid = 'public.quotes'::regclass
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_other_rand_nonneg CHECK (other_rand >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_items_qty_pos' AND conrelid = 'public.quote_items'::regclass
  ) THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT quote_items_qty_pos CHECK (qty > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_items_unit_nonneg' AND conrelid = 'public.quote_items'::regclass
  ) THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT quote_items_unit_nonneg CHECK (unit_rand >= 0);
  END IF;
END $$;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY job_id, client_id ORDER BY created_at, id) AS n
  FROM public.reviews
)
DELETE FROM public.reviews r
USING ranked x
WHERE r.id = x.id AND x.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_client_job
  ON public.reviews (job_id, client_id);

CREATE OR REPLACE FUNCTION public.protect_profile() RETURNS trigger
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
     OR NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at
  THEN
    RAISE EXCEPTION 'protected profile field';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect ON public.profiles;
CREATE TRIGGER profiles_protect
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chosen text;
  v_terms timestamptz;
BEGIN
  chosen := COALESCE(NEW.raw_user_meta_data ->> 'role', 'client');
  IF chosen NOT IN ('client', 'contractor') THEN
    chosen := 'client';
  END IF;
  BEGIN
    v_terms := NULLIF(NEW.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_terms := NULL;
  END;
  INSERT INTO public.profiles (id, role, full_name, phone, user_code, terms_accepted_at)
  VALUES (
    NEW.id,
    chosen,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(COALESCE(NEW.email, 'member'), '@', 1)),
    NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
    'MQ-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8)),
    v_terms
  );
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- Wording helpers. Internal. Not granted to the website.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ordinal_en(p_n integer) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(p_n, 0)::text || CASE
    WHEN COALESCE(p_n, 0) % 100 IN (11, 12, 13) THEN 'th'
    WHEN COALESCE(p_n, 0) % 10 = 1 THEN 'st'
    WHEN COALESCE(p_n, 0) % 10 = 2 THEN 'nd'
    WHEN COALESCE(p_n, 0) % 10 = 3 THEN 'rd'
    ELSE 'th'
  END;
$$;

CREATE OR REPLACE FUNCTION public.format_rand(p_amount integer) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  s text := abs(COALESCE(p_amount, 0))::text;
  out text := '';
  i integer;
BEGIN
  FOR i IN 1..length(s) LOOP
    IF i > 1 AND (length(s) - i + 1) % 3 = 0 THEN
      out := out || ',';
    END IF;
    out := out || substr(s, i, 1);
  END LOOP;
  IF COALESCE(p_amount, 0) < 0 THEN
    RETURN '-R' || out;
  END IF;
  RETURN 'R' || out;
END;
$$;


-- ---------------------------------------------------------------------------
-- Stable anonymised labels. Assigned once, in the order people first bid.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bid_aliases (
  job_id uuid NOT NULL REFERENCES public.job_requests (id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles (id),
  label text NOT NULL,
  PRIMARY KEY (job_id, contractor_id)
);

ALTER TABLE public.bid_aliases ENABLE ROW LEVEL SECURITY;

INSERT INTO public.bid_aliases (job_id, contractor_id, label)
SELECT job_id, contractor_id,
  CASE
    WHEN rn <= 26 THEN 'Contractor ' || chr(64 + rn::integer)
    ELSE 'Contractor ' || rn::text
  END
FROM (
  SELECT job_id, contractor_id,
         row_number() OVER (PARTITION BY job_id ORDER BY min(created_at), contractor_id) AS rn
  FROM public.bids
  GROUP BY job_id, contractor_id
) ranked
ON CONFLICT (job_id, contractor_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_bid_alias() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer;
  v_label text;
BEGIN
  PERFORM 1 FROM public.job_requests WHERE id = NEW.job_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.bid_aliases
    WHERE job_id = NEW.job_id AND contractor_id = NEW.contractor_id
  ) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO n FROM public.bid_aliases WHERE job_id = NEW.job_id;
  n := COALESCE(n, 0) + 1;
  IF n <= 26 THEN
    v_label := 'Contractor ' || chr(64 + n);
  ELSE
    v_label := 'Contractor ' || n::text;
  END IF;
  INSERT INTO public.bid_aliases (job_id, contractor_id, label)
  VALUES (NEW.job_id, NEW.contractor_id, v_label)
  ON CONFLICT (job_id, contractor_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bids_assign_alias ON public.bids;
CREATE TRIGGER bids_assign_alias
  BEFORE INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.assign_bid_alias();

DROP FUNCTION IF EXISTS public.bid_board(uuid);

CREATE FUNCTION public.bid_board(p_job uuid)
RETURNS TABLE (label text, amount integer, is_you boolean, vip boolean, place integer, anon text)
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
      ELSE COALESCE(a.label, 'Contractor ' || chr(64 + r.rk::integer))
    END,
    r.amount,
    r.contractor_id = v_uid,
    (p.vip_until IS NOT NULL AND p.vip_until > now()),
    r.rk,
    COALESCE(a.label, 'Contractor ' || chr(64 + r.rk::integer))
  FROM public.bid_ranks(p_job) r
  JOIN public.profiles p ON p.id = r.contractor_id
  LEFT JOIN public.bid_aliases a
    ON a.job_id = p_job AND a.contractor_id = r.contractor_id
  WHERE r.rk <= COALESCE(public.setting_int('places'), 3)
     OR r.contractor_id = v_uid
  ORDER BY r.rk;
END;
$$;


-- ---------------------------------------------------------------------------
-- After a quote is accepted, only the chosen plumber still sees the client's
-- phone. The client only sees that plumber's phone. Admins still see all.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.unlocked_contacts(p_job uuid)
RETURNS TABLE (who text, name text, phone text, business_name text, person_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_accepted uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT j.status INTO v_status FROM public.job_requests j WHERE j.id = p_job;
  SELECT q.contractor_id INTO v_accepted
  FROM public.quotes q
  WHERE q.job_id = p_job AND q.status = 'accepted'
  LIMIT 1;

  IF public.is_admin() OR EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = p_job AND j.client_id = v_uid
  ) THEN
    IF EXISTS (SELECT 1 FROM public.auction_results ar WHERE ar.job_id = p_job) OR public.is_admin() THEN
      RETURN QUERY
      SELECT 'contractor'::text, p.full_name, p.phone, p.business_name, p.id
      FROM public.auction_results ar
      JOIN public.profiles p ON p.id = ar.contractor_id
      WHERE ar.job_id = p_job
        AND (
          public.is_admin()
          OR v_status IS DISTINCT FROM 'accepted'
          OR ar.contractor_id IS NOT DISTINCT FROM v_accepted
        )
      ORDER BY ar.place;
      IF NOT public.is_admin() THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  IF public.is_admin() OR (
    public.is_winner(p_job, v_uid)
    AND (
      v_status IS DISTINCT FROM 'accepted'
      OR v_uid IS NOT DISTINCT FROM v_accepted
    )
  ) THEN
    RETURN QUERY
    SELECT 'client'::text, rp.contact_name, rp.phone, NULL::text, j.client_id
    FROM public.request_private rp
    JOIN public.job_requests j ON j.id = rp.job_id
    WHERE rp.job_id = p_job;
  END IF;
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
        'A higher bid pushed you out of the top 3. Your held tokens were released. You can bid again from the lead.',
        '#/contractor/lead/' || p_job);
    END IF;
  END LOOP;

  PERFORM public.notify(v_job.client_id, 'New bid',
    'A contractor bid ' || p_amount || CASE WHEN p_amount = 1 THEN ' token.' ELSE ' tokens.' END,
    '#/client/request/' || p_job);

  SELECT rk, (SELECT count(*)::integer FROM public.bid_ranks(p_job))
  INTO v_my_rank, v_count
  FROM public.bid_ranks(p_job)
  WHERE contractor_id = v_uid;

  PERFORM public.notify(v_uid, 'Bid placed',
    'You bid ' || p_amount || CASE WHEN p_amount = 1 THEN ' token' ELSE ' tokens' END
    || '. You are ' || public.ordinal_en(COALESCE(v_my_rank, 0)) || ' of ' || COALESCE(v_count, 0)
    || '. You only pay if you finish in the top ' || v_places
    || '. If you are outbid, held tokens are released.',
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

CREATE OR REPLACE FUNCTION public.close_auction(p_job uuid) RETURNS jsonb
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
      'You finished in the top ' || v_places || '. Send your quote so the client can compare it.',
      '#/contractor/quote/' || p_job);
  END LOOP;

  FOR rec IN
    SELECT contractor_id FROM public.bid_ranks(p_job) WHERE rk > v_places
  LOOP
    PERFORM public.release_hold(rec.contractor_id, p_job, 'Did not win a place');
    PERFORM public.notify(rec.contractor_id, 'Auction ended',
      'You did not finish in the top ' || v_places || '. Held tokens were released.',
      '#/contractor/lead/' || p_job);
  END LOOP;

  UPDATE public.job_requests SET status = 'matched' WHERE id = p_job;
  PERFORM public.notify(v_job.client_id, 'Quotes due',
    'Bidding has ended. ' || v_place || CASE WHEN v_place = 1 THEN ' contractor can send a quote.' ELSE ' contractors can send quotes.' END
    || ' You can compare them here.',
    '#/client/request/' || p_job);
  PERFORM public.audit_write('close_auction', 'job_requests', p_job,
    jsonb_build_object('winners', v_place));
  RETURN jsonb_build_object('ok', true, 'winners', v_place);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_quote(
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
  v_name text;
  v_total integer;
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
  SELECT COALESCE(NULLIF(btrim(business_name), ''), NULLIF(btrim(full_name), ''), 'A contractor')
  INTO v_name
  FROM public.profiles WHERE id = v_uid;
  v_total := COALESCE(p_materials, 0) + COALESCE(p_labour, 0) + COALESCE(p_callout, 0);
  PERFORM public.notify(
    (SELECT client_id FROM public.job_requests WHERE id = p_job),
    'Quote received',
    v_name || ' quoted ' || public.format_rand(v_total) || '.',
    '#/client/request/' || p_job
  );
  RETURN jsonb_build_object('ok', true, 'id', v_quote);
END;
$$;

CREATE OR REPLACE FUNCTION public.my_profile() RETURNS jsonb
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
    'token_held', token_held,
    'terms_accepted_at', terms_accepted_at
  ) INTO v
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN v;
END;
$$;


-- ---------------------------------------------------------------------------
-- Line-item quotes. The original save_quote stays, so older pages still work.
-- Editing is allowed only while the quote is still open.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_quote_lines(
  p_job uuid,
  p_items jsonb,
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
  v_quote_status text;
  v_name text;
  v_total integer := 0;
  v_materials integer := 0;
  v_labour integer := 0;
  v_callout integer := 0;
  v_other integer := 0;
  v_updated boolean := false;
  v_days integer;
  item jsonb;
  v_label text;
  v_qty numeric;
  v_unit integer;
  v_kind text;
  v_line integer;
  v_pos integer := 0;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.is_winner(p_job, v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'only winners can quote');
  END IF;

  SELECT status INTO v_status FROM public.job_requests WHERE id = p_job FOR UPDATE;
  IF v_status NOT IN ('matched', 'quoting') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quotes are closed');
  END IF;
  IF COALESCE(btrim(p_included), '') = ''
     OR COALESCE(btrim(p_excluded), '') = ''
     OR COALESCE(btrim(p_timeline), '') = ''
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'add what is included, excluded, and a timeline');
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'add at least one line');
  END IF;
  v_count := jsonb_array_length(p_items);
  IF v_count < 1 OR v_count > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'add between 1 and 40 lines');
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_label := btrim(COALESCE(item ->> 'description', item ->> 'label', ''));
    v_qty := COALESCE((item ->> 'qty')::numeric, 0);
    v_unit := COALESCE((item ->> 'unit_rand')::integer, (item ->> 'unit')::integer, 0);
    v_kind := COALESCE(NULLIF(btrim(item ->> 'kind'), ''), 'other');
    IF v_label = '' OR length(v_label) > 200 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'each line needs a short description');
    END IF;
    IF v_qty <= 0 OR v_qty > 100000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'quantity must be above zero');
    END IF;
    IF v_unit < 0 OR v_unit > 10000000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'unit price must be zero or more');
    END IF;
    IF v_kind NOT IN ('material', 'labour', 'callout', 'other') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'unknown line type');
    END IF;
    v_line := round(v_qty * v_unit)::integer;
    v_total := v_total + v_line;
    IF v_kind = 'material' THEN v_materials := v_materials + v_line;
    ELSIF v_kind = 'labour' THEN v_labour := v_labour + v_line;
    ELSIF v_kind = 'callout' THEN v_callout := v_callout + v_line;
    ELSE v_other := v_other + v_line;
    END IF;
  END LOOP;

  IF v_total < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amounts must be zero or more');
  END IF;

  v_days := COALESCE(p_valid_days, 14);
  IF v_days < 1 OR v_days > 365 THEN
    v_days := 14;
  END IF;

  SELECT vat_registered INTO v_vat FROM public.profiles WHERE id = v_uid;
  SELECT COALESCE(NULLIF(btrim(business_name), ''), NULLIF(btrim(full_name), ''), 'A contractor')
  INTO v_name
  FROM public.profiles WHERE id = v_uid;

  SELECT id, status INTO v_quote, v_quote_status
  FROM public.quotes
  WHERE job_id = p_job AND contractor_id = v_uid
  FOR UPDATE;

  IF v_quote IS NOT NULL AND v_quote_status <> 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quotes are closed');
  END IF;

  IF v_quote IS NULL THEN
    INSERT INTO public.quotes (
      job_id, contractor_id, materials_rand, labour_rand, callout_rand, other_rand,
      included, excluded, vat_registered, timeline, valid_until
    ) VALUES (
      p_job, v_uid, v_materials, v_labour, v_callout, v_other,
      btrim(p_included), btrim(p_excluded), COALESCE(v_vat, false), btrim(p_timeline),
      CURRENT_DATE + v_days
    ) RETURNING id INTO v_quote;
  ELSE
    v_updated := true;
    UPDATE public.quotes SET
      materials_rand = v_materials,
      labour_rand = v_labour,
      callout_rand = v_callout,
      other_rand = v_other,
      included = btrim(p_included),
      excluded = btrim(p_excluded),
      vat_registered = COALESCE(v_vat, false),
      timeline = btrim(p_timeline),
      valid_until = CURRENT_DATE + v_days
    WHERE id = v_quote;
    DELETE FROM public.quote_items WHERE quote_id = v_quote;
  END IF;

  v_pos := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_label := btrim(COALESCE(item ->> 'description', item ->> 'label', ''));
    v_qty := (item ->> 'qty')::numeric;
    v_unit := COALESCE((item ->> 'unit_rand')::integer, (item ->> 'unit')::integer, 0);
    v_kind := COALESCE(NULLIF(btrim(item ->> 'kind'), ''), 'other');
    v_line := round(v_qty * v_unit)::integer;
    v_pos := v_pos + 1;
    INSERT INTO public.quote_items (quote_id, label, rand, kind, qty, unit_rand, position)
    VALUES (v_quote, v_label, v_line, v_kind, v_qty, v_unit, v_pos);
  END LOOP;

  UPDATE public.job_requests SET status = 'quoting' WHERE id = p_job AND status = 'matched';

  PERFORM public.notify(
    (SELECT client_id FROM public.job_requests WHERE id = p_job),
    CASE WHEN v_updated THEN 'Quote updated' ELSE 'Quote received' END,
    v_name || CASE WHEN v_updated THEN ' updated their quote to ' ELSE ' quoted ' END
      || public.format_rand(v_total) || '.',
    '#/client/request/' || p_job
  );

  RETURN jsonb_build_object('ok', true, 'id', v_quote, 'total', v_total, 'updated', v_updated);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'you already sent a quote');
END;
$$;


-- ---------------------------------------------------------------------------
-- Privileges. New public functions are not executable by anon or signed-in
-- users unless this list says so. Re-running the security script revokes
-- these grants; that script grants save_quote_lines again when it exists.
-- ---------------------------------------------------------------------------

-- Replacing a function counts as CREATE FUNCTION. If the security event
-- trigger is installed, it strips anon and authenticated from every function
-- this file replaces. Grant the website RPCs again afterwards.
REVOKE ALL ON FUNCTION public.ordinal_en(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.format_rand(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_bid_alias() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_auction(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bid_board(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unlocked_contacts(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_bid(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_quote(uuid, integer, integer, integer, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_quote_lines(uuid, jsonb, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_profile() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bid_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlocked_contacts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_quote(uuid, integer, integer, integer, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_quote_lines(uuid, jsonb, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;

REVOKE ALL ON TABLE public.bid_aliases FROM PUBLIC, anon, authenticated;
