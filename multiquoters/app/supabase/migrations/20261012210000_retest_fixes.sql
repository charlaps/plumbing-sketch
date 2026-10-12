-- Retest fixes after the launch migration.
-- Apply after 20261012180000_launch_fixes.sql. Safe to run again.
-- Hosted Supabase runs this as postgres, which is not a superuser.
-- Money movement is unchanged.

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
    PERFORM public.notify(rec.contractor_id, 'You are in the top 3',
      'You finished in the top ' || v_places || '. Send your quote so the client can compare it.',
      '#/contractor/quote/' || p_job);
  END LOOP;

  FOR rec IN
    SELECT contractor_id FROM public.bid_ranks(p_job) WHERE rk > v_places
  LOOP
    PERFORM public.release_hold(rec.contractor_id, p_job, 'Did not win a place');
    PERFORM public.notify(rec.contractor_id, 'Outside the top 3',
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

CREATE OR REPLACE FUNCTION public.preview_bid(p_job uuid, p_amount integer) RETURNS jsonb
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
    'held', COALESCE(v_prev, 0),
    'in_top', v_my_rank IS NOT NULL AND v_my_rank <= v_places
  );
END;
$$;

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
    PERFORM public.notify(rec.contractor_id, 'Another quote was accepted',
      'The client accepted a different quote. Their contact details are no longer shown here.',
      '#/contractor/lead/' || v_job);
  END LOOP;

  PERFORM public.audit_write('accept_quote', 'quotes', p_quote, jsonb_build_object('job', v_job));
  RETURN jsonb_build_object('ok', true, 'job_id', v_job);
END;
$$;

-- Replacing a function counts as CREATE FUNCTION. If the security event
-- trigger is installed, it strips anon and authenticated. Grant the website
-- RPCs again afterwards. close_auction stays internal.
REVOKE ALL ON FUNCTION public.preview_bid(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_bid(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_auction(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_quote(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.preview_bid(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_quote(uuid) TO authenticated;
