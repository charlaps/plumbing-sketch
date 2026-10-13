-- Voice notes, plans, and trade registration. Runs after the feature migration.
-- Money movement stays the same: a bid still holds the tokens the contractor bid.

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);

SELECT public._assert(
  (SELECT count(*) FROM public.governing_bodies) = 5
  AND (SELECT required FROM public.trade_body_rules WHERE trade = 'Plumbing' AND body_code = 'pirb')
  AND (SELECT required FROM public.trade_body_rules WHERE trade = 'Electrical' AND body_code = 'doel')
  AND NOT (SELECT required FROM public.trade_body_rules WHERE trade = 'Electrical' AND body_code = 'eca')
  AND (SELECT required FROM public.trade_body_rules WHERE trade = 'Building' AND body_code = 'nhbrc')
  AND (SELECT required FROM public.trade_body_rules WHERE trade = 'Geyser' AND body_code = 'pirb')
  AND (SELECT required FROM public.trade_body_rules WHERE trade = 'Gas' AND body_code = 'saqcc')
  AND NOT EXISTS (SELECT 1 FROM public.trade_body_rules WHERE trade = 'Painting' AND required),
  'trade bodies match the South African registration rules'
);

SELECT public._assert(
  NOT has_function_privilege('anon', 'public.registration_ok(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.registration_ok(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.expire_registrations(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.expire_registrations(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.guard_job_audio()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.guard_job_plan()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.submit_registration(text, text, text, date, text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.submit_registration(text, text, text, date, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.review_registration(uuid, text, text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.review_registration(uuid, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.place_bid(uuid, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.place_bid(uuid, integer)', 'EXECUTE'),
  'registration helpers stay internal and the two review RPCs are granted'
);

SELECT public._assert(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.contractor_registrations'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.job_audio'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.job_plans'::regclass)
  AND NOT has_table_privilege('anon', 'public.job_audio', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.job_plans', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.contractor_registrations', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.contractor_registrations', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.contractor_registrations', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.governing_bodies', 'SELECT')
  AND has_table_privilege('authenticated', 'public.job_audio', 'INSERT')
  AND has_table_privilege('authenticated', 'public.job_plans', 'SELECT')
  AND has_table_privilege('authenticated', 'public.registration_badges', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.registration_badges', 'SELECT'),
  'new tables are private and only job files are writable by signed-in users'
);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('f1111111-1111-4111-8111-111111111111', 'reg-client@example.com', '{"role":"client","full_name":"Reg Client"}'),
  ('f2222222-2222-4222-8222-222222222222', 'reg-plumb@example.com', '{"role":"contractor","full_name":"Reg Plumber"}'),
  ('f3333333-3333-4333-8333-333333333333', 'reg-spark@example.com', '{"role":"contractor","full_name":"Reg Electrician"}'),
  ('f4444444-4444-4444-8444-444444444444', 'reg-build@example.com', '{"role":"contractor","full_name":"Reg Builder"}'),
  ('f5555555-5555-4555-8555-555555555555', 'reg-other@example.com', '{"role":"client","full_name":"Other Client"}');

UPDATE public.profiles SET
  verified = true,
  trades = ARRAY['Plumbing'],
  areas = ARRAY['Johannesburg North'],
  phone = '0820001111',
  token_available = 10
WHERE id = 'f2222222-2222-4222-8222-222222222222';
UPDATE public.profiles SET
  verified = true,
  trades = ARRAY['Electrical'],
  areas = ARRAY['Johannesburg North'],
  phone = '0820002222',
  token_available = 8
WHERE id = 'f3333333-3333-4333-8333-333333333333';
UPDATE public.profiles SET
  verified = true,
  trades = ARRAY['Building'],
  areas = ARRAY['Johannesburg North'],
  phone = '0820003333',
  token_available = 8
WHERE id = 'f4444444-4444-4444-8444-444444444444';

SELECT set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', false);
INSERT INTO public._t (name, id)
SELECT 'reg_plumb', (public.create_job(
  'Plumbing', 'Reg tap', 'Drip', 'Bryanston', 'Johannesburg North',
  'This week', 'Reg Client', '0821111111', NULL
) ->> 'id')::uuid;
INSERT INTO public._t (name, id)
SELECT 'reg_elec', (public.create_job(
  'Electrical', 'Reg plug', 'Plug', 'Bryanston', 'Johannesburg North',
  'This week', 'Reg Client', '0821111111', NULL
) ->> 'id')::uuid;
INSERT INTO public._t (name, id)
SELECT 'reg_build', (public.create_job(
  'Building', 'Reg wall', 'Wall', 'Bryanston', 'Johannesburg North',
  'This week', 'Reg Client', '0821111111', NULL
) ->> 'id')::uuid;

SELECT set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'reg_plumb'), 1) ->> 'error') = 'registration required',
  'a verified plumber without PIRB cannot bid'
);
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = 'f2222222-2222-4222-8222-222222222222') = 10
  AND (SELECT count(*) FROM public.bids WHERE contractor_id = 'f2222222-2222-4222-8222-222222222222') = 0,
  'a blocked registration does not move tokens'
);

SELECT public._assert(
  (public.submit_registration(
    'Plumbing', 'pirb', 'PIRB-100', current_date + 30,
    'f2222222-2222-4222-8222-222222222222/registration/card.jpg'
  ) ->> 'ok')::boolean,
  'the plumber can submit a PIRB number'
);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'reg_plumb'), 1) ->> 'error') = 'registration required',
  'a pending PIRB registration cannot bid'
);

SELECT set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', false);
DO $$
BEGIN
  PERFORM public.review_registration(
    (SELECT id FROM public.contractor_registrations WHERE profile_id = 'f2222222-2222-4222-8222-222222222222'),
    'verified', NULL
  );
  RAISE EXCEPTION 'FAIL: contractor reviewed their own registration';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%admin only%' THEN
      RAISE;
    END IF;
END $$;
SELECT public._assert(true, 'a contractor cannot verify their own registration');

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SELECT public._assert(
  (public.review_registration(
    (SELECT id FROM public.contractor_registrations WHERE profile_id = 'f2222222-2222-4222-8222-222222222222' AND status = 'pending'),
    'rejected', 'x'
  ) ->> 'error') = 'a reason is required',
  'a rejection needs a reason'
);
SELECT public._assert(
  (public.review_registration(
    (SELECT id FROM public.contractor_registrations WHERE profile_id = 'f2222222-2222-4222-8222-222222222222' AND status = 'pending'),
    'rejected', 'Number is not on the PIRB register'
  ) ->> 'ok')::boolean,
  'an admin can reject a registration'
);
SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = 'f2222222-2222-4222-8222-222222222222'
      AND title = 'Registration not accepted'
      AND body LIKE '%not on the PIRB register%'
  ),
  'the plumber is told why the registration was rejected'
);

SELECT set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', false);
SELECT public._assert(
  (public.submit_registration(
    'Plumbing', 'pirb', 'PIRB-200', current_date + 400,
    'f2222222-2222-4222-8222-222222222222/registration/card-2.jpg'
  ) ->> 'ok')::boolean,
  'a rejected plumber can send the registration again'
);
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SELECT public._assert(
  (public.review_registration(
    (SELECT id FROM public.contractor_registrations
      WHERE profile_id = 'f2222222-2222-4222-8222-222222222222' AND status = 'pending'),
    'verified', NULL
  ) ->> 'ok')::boolean,
  'an admin can verify a PIRB registration'
);

SELECT set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', false);
WITH bid AS (
  SELECT public.place_bid((SELECT id FROM public._t WHERE name = 'reg_plumb'), 1) AS result
)
SELECT public._assert(
  (SELECT (result ->> 'ok')::boolean AND (result ->> 'due')::int = 1 FROM bid),
  'a PIRB verified plumber can bid and the bid is due in full'
);
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = 'f2222222-2222-4222-8222-222222222222') = 9
  AND (SELECT token_held FROM public.profiles WHERE id = 'f2222222-2222-4222-8222-222222222222') = 1
  AND (SELECT tokens FROM public.token_holds
       WHERE profile_id = 'f2222222-2222-4222-8222-222222222222'
         AND job_id = (SELECT id FROM public._t WHERE name = 'reg_plumb')) = 1,
  'the verified bid holds one token and leaves the rest available'
);
SELECT public._assert(
  (SELECT short_label FROM public.registration_badges
    WHERE profile_id = 'f2222222-2222-4222-8222-222222222222' AND trade = 'Plumbing') = 'PIRB',
  'clients can see a PIRB badge without the registration number'
);
SELECT public._assert(
  NOT EXISTS (
    SELECT 1 FROM public.registration_badges
    WHERE profile_id = 'f2222222-2222-4222-8222-222222222222'
      AND short_label LIKE '%PIRB-200%'
  ),
  'the badge view does not carry the registration number'
);

-- Expiry blocks the next bid and tells the contractor and the admin.
UPDATE public.contractor_registrations
SET expires_on = current_date - 1
WHERE profile_id = 'f2222222-2222-4222-8222-222222222222' AND status = 'verified';
SELECT set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'reg_plumb'), 2) ->> 'error') = 'registration expired',
  'an expired PIRB registration cannot bid'
);
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = 'f2222222-2222-4222-8222-222222222222') = 9
  AND (SELECT token_held FROM public.profiles WHERE id = 'f2222222-2222-4222-8222-222222222222') = 1,
  'an expired registration does not change the wallet'
);
SELECT public._assert(
  (SELECT status FROM public.contractor_registrations
    WHERE profile_id = 'f2222222-2222-4222-8222-222222222222' AND body_code = 'pirb'
    ORDER BY created_at DESC LIMIT 1) = 'expired'
  AND EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = 'f2222222-2222-4222-8222-222222222222'
      AND title = 'Registration expired'
  )
  AND EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND title = 'Registration expired'
  ),
  'expiry is flagged and the contractor and admin are notified'
);

-- Electrical needs the wireman licence. ECA is optional. Building needs NHBRC.
SELECT set_config('request.jwt.claim.sub', 'f3333333-3333-4333-8333-333333333333', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'reg_elec'), 1) ->> 'error') = 'registration required',
  'an electrician without a wireman licence cannot bid'
);
SELECT public._assert(
  (public.submit_registration(
    'Electrical', 'doel', 'WL-55', current_date + 200,
    'f3333333-3333-4333-8333-333333333333/registration/wireman.jpg'
  ) ->> 'ok')::boolean,
  'the electrician submits a wireman licence'
);
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SELECT public.review_registration(
  (SELECT id FROM public.contractor_registrations WHERE profile_id = 'f3333333-3333-4333-8333-333333333333' AND status = 'pending'),
  'verified', NULL
);
SELECT set_config('request.jwt.claim.sub', 'f3333333-3333-4333-8333-333333333333', false);
WITH bid AS (
  SELECT public.place_bid((SELECT id FROM public._t WHERE name = 'reg_elec'), 1) AS result
)
SELECT public._assert(
  (SELECT (result ->> 'ok')::boolean AND (result ->> 'due')::int = 1 FROM bid),
  'ECA membership is optional once the wireman licence is verified'
);
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = 'f3333333-3333-4333-8333-333333333333') = 7,
  'the electrical bid holds one token'
);

SELECT set_config('request.jwt.claim.sub', 'f4444444-4444-4444-8444-444444444444', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'reg_build'), 1) ->> 'error') = 'registration required',
  'a builder without NHBRC cannot bid'
);

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'reg_plumb'), 3) ->> 'error') = 'contractors only',
  'an admin still cannot bid'
);

-- Painting has no required body, so the existing verified painter can bid.
SELECT set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', false);
INSERT INTO public._t (name, id)
SELECT 'reg_paint', (public.create_job(
  'Painting', 'Reg paint', 'Walls', 'Bryanston', 'Johannesburg North',
  'This week', 'Reg Client', '0821111111', NULL
) ->> 'id')::uuid;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'reg_paint'), 1) ->> 'ok')::boolean,
  'a verified painter can bid without a governing-body number'
);

-- Voice notes and plans: the client, not another client, and only a winner.
SELECT set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
INSERT INTO public.job_audio (job_id, storage_path, mime, duration_seconds, bytes)
SELECT id, id::text || '/note-1.webm', 'audio/webm', 30, 12000 FROM public._t WHERE name = 'reg_plumb';
INSERT INTO public.job_audio (job_id, storage_path, mime, duration_seconds, bytes)
SELECT id, id::text || '/note-2.m4a', 'audio/mp4', 120, 80000 FROM public._t WHERE name = 'reg_plumb';
INSERT INTO public.job_audio (job_id, storage_path, mime, duration_seconds, bytes)
SELECT id, id::text || '/note-3.webm', 'audio/webm', 10, 4000 FROM public._t WHERE name = 'reg_plumb';
INSERT INTO public.job_plans (job_id, storage_path, file_name, mime, bytes)
SELECT id, id::text || '/plan.pdf', 'kitchen.pdf', 'application/pdf', 200000 FROM public._t WHERE name = 'reg_plumb';
RESET ROLE;
SELECT public._assert(
  (SELECT count(*) FROM public.job_audio WHERE job_id = (SELECT id FROM public._t WHERE name = 'reg_plumb')) = 3
  AND (SELECT count(*) FROM public.job_plans WHERE job_id = (SELECT id FROM public._t WHERE name = 'reg_plumb')) = 1,
  'the client stored three voice notes and a plan'
);

SELECT set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
DO $$
BEGIN
  INSERT INTO public.job_audio (job_id, storage_path, mime, duration_seconds, bytes)
  SELECT id, id::text || '/note-4.webm', 'audio/webm', 5, 1000 FROM public._t WHERE name = 'reg_plumb';
  RAISE EXCEPTION 'FAIL: a fourth voice note was stored';
EXCEPTION
  WHEN check_violation THEN NULL;
END $$;
DO $$
BEGIN
  INSERT INTO public.job_audio (job_id, storage_path, mime, duration_seconds, bytes)
  SELECT id, id::text || '/long.webm', 'audio/webm', 121, 1000 FROM public._t WHERE name = 'reg_paint';
  RAISE EXCEPTION 'FAIL: a voice note over 2 minutes was stored';
EXCEPTION
  WHEN check_violation THEN NULL;
END $$;
DO $$
BEGIN
  INSERT INTO public.job_plans (job_id, storage_path, file_name, mime, bytes)
  SELECT id, id::text || '/big.pdf', 'big.pdf', 'application/pdf', 10485761 FROM public._t WHERE name = 'reg_paint';
  RAISE EXCEPTION 'FAIL: a plan over 10 MB was stored';
EXCEPTION
  WHEN check_violation THEN NULL;
END $$;
RESET ROLE;
SELECT public._assert(true, 'voice notes stop at three and at 2 minutes, and plans stop at 10 MB');

SELECT set_config('request.jwt.claim.sub', 'f5555555-5555-4555-8555-555555555555', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.job_audio WHERE job_id = (SELECT id FROM public._t WHERE name = 'reg_plumb')) = 0,
  'another client cannot read the voice notes'
);
DO $$
BEGIN
  INSERT INTO public.job_plans (job_id, storage_path, file_name, mime, bytes)
  SELECT id, id::text || '/stolen.pdf', 'stolen.pdf', 'application/pdf', 1000 FROM public._t WHERE name = 'reg_plumb';
  RAISE EXCEPTION 'FAIL: another client uploaded a plan';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'f3333333-3333-4333-8333-333333333333', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.job_audio WHERE job_id = (SELECT id FROM public._t WHERE name = 'reg_plumb')) = 0,
  'a contractor who has not won the lead cannot read the voice notes'
);
RESET ROLE;

INSERT INTO public.auction_results (job_id, contractor_id, place, bid_amount, tokens_spent)
SELECT id, 'f2222222-2222-4222-8222-222222222222', 1, 1, 1 FROM public._t WHERE name = 'reg_plumb';
SELECT set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.job_audio WHERE job_id = (SELECT id FROM public._t WHERE name = 'reg_plumb')) = 3
  AND (SELECT count(*) FROM public.job_plans WHERE job_id = (SELECT id FROM public._t WHERE name = 'reg_plumb')) = 1,
  'a contractor in the top 3 can read the voice notes and the plan'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'f3333333-3333-4333-8333-333333333333', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.contractor_registrations WHERE profile_id = 'f2222222-2222-4222-8222-222222222222') = 0,
  'a contractor cannot read another contractor registration number'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.contractor_registrations WHERE profile_id = 'f2222222-2222-4222-8222-222222222222') >= 1
  AND public.admin_snapshot() -> 'contractors' IS NOT NULL,
  'an admin can read registrations from the admin list'
);
RESET ROLE;

SELECT public._assert(
  (SELECT proowner::regrole::text FROM pg_proc WHERE oid = 'public.place_bid(uuid, integer)'::regprocedure) = 'mq_postgres'
  AND (SELECT proowner::regrole::text FROM pg_proc WHERE oid = 'public.submit_registration(text, text, text, date, text)'::regprocedure) = 'mq_postgres',
  'the feature migration is owned by the hosted postgres role'
);

SELECT 'REGISTRATION TESTS PASSED' AS result;
