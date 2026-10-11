-- Proves the security migration blocks the reviewed exploits, and that the
-- normal path still works when the caller is anon or authenticated.
-- Runs after rpc_test.sql, as a superuser, on the same database.

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
GRANT INSERT, SELECT ON public._t TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  fn text;
  who name;
  blocked text[] := ARRAY[
    'public.setting_int(text)',
    'public.bid_ranks(uuid)',
    'public.release_hold(uuid, uuid, text)',
    'public.spend_hold(uuid, uuid)',
    'public.handle_new_user()',
    'public.protect_profile()',
    'public.audit_write(text, text, uuid, jsonb)',
    'public.notify(uuid, text, text, text)',
    'public.notify_due_leads()',
    'public.close_expired_auctions()',
    'public.close_auction(uuid)',
    'public.is_winner(uuid, uuid)',
    'public.is_admin()',
    'public.contractor_can_see_job(uuid)',
    'public.can_review(uuid, uuid)',
    'public.collapse_vip_cover()'
  ];
BEGIN
  FOREACH fn IN ARRAY blocked LOOP
    FOREACH who IN ARRAY ARRAY['anon', 'authenticated']::name[] LOOP
      IF has_function_privilege(who, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL: % can execute %', who, fn;
      END IF;
    END LOOP;
  END LOOP;
END $$;
SELECT public._assert(true, 'anon and authenticated cannot execute internal functions');

SELECT public._assert(
  has_function_privilege('anon', 'public.public_settings()', 'EXECUTE')
  AND has_function_privilege('anon', 'public.public_contractor(text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.place_bid(uuid, integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.create_job(text, text, text, text, text, text, text, text, text)', 'EXECUTE'),
  'anon can read public settings and contractor pages only'
);
SELECT public._assert(
  has_function_privilege('authenticated', 'public.place_bid(uuid, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.create_job(text, text, text, text, text, text, text, text, text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.accept_quote(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.send_message(uuid, text, uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.save_quote(uuid, integer, integer, integer, text, text, text, integer)', 'EXECUTE'),
  'signed-in users can still call the website RPCs'
);
SELECT public._assert(
  NOT has_table_privilege('anon', 'public.contractor_cards', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.contractor_cards', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.contractor_cards', 'DELETE')
  AND has_table_privilege('anon', 'public.contractor_cards', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.contractor_cards', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.contractor_cards', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.profiles', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.profiles', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.bids', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.token_ledger', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.messages', 'INSERT')
  AND has_table_privilege('authenticated', 'public.request_photos', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.request_photos', 'INSERT'),
  'write grants are limited to the photo upload the website performs'
);

SELECT public._assert(
  NOT (SELECT rolsuper FROM pg_roles WHERE rolname = 'mq_postgres')
  AND NOT pg_has_role('mq_postgres', 'supabase_admin', 'MEMBER')
  AND NOT pg_has_role('mq_postgres', 'postgres', 'MEMBER')
  AND (
    SELECT pg_get_userbyid(proowner)
    FROM pg_proc
    WHERE oid = 'public.send_message(uuid, text, uuid)'::regprocedure
  ) = 'mq_postgres'
  AND NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'mq_revoke_public_execute'),
  'the security migration was applied by a non-superuser who is not supabase_admin'
);

-- Hosted postgres cannot install this trigger. The migration notices and
-- continues. Create it here, as the superuser running the tests, so a
-- function added afterwards stays locked.
CREATE EVENT TRIGGER mq_revoke_public_execute
  ON ddl_command_end
  WHEN TAG IN ('CREATE FUNCTION')
  EXECUTE FUNCTION mq_guard.revoke_public_execute();

-- Created by the same role that owns the app. The event trigger runs as that
-- role and can revoke the new function.
SET ROLE mq_postgres;
CREATE FUNCTION public._mq_should_not_leak() RETURNS integer
LANGUAGE sql AS $$ SELECT 1 $$;
RESET ROLE;
SELECT public._assert(
  NOT has_function_privilege('anon', 'public._mq_should_not_leak()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public._mq_should_not_leak()', 'EXECUTE'),
  'a function created later is not granted to anon or authenticated'
);
SET ROLE mq_postgres;
DROP FUNCTION public._mq_should_not_leak();
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Directory view cannot rename, wipe, or delete a contractor
-- ---------------------------------------------------------------------------

SELECT public._assert(
  (SELECT business_name FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 'West Rand Plumbing',
  'VIP business name starts unchanged'
);

DO $$
BEGIN
  UPDATE public.contractor_cards SET business_name = 'Hacked' WHERE id = '77777777-7777-4777-8777-777777777777';
  RAISE EXCEPTION 'FAIL: owner could write the contractor view';
EXCEPTION
  WHEN object_not_in_prerequisite_state THEN NULL;
END $$;
SELECT public._assert(true, 'the contractor view is not updatable, even for the owner');

SELECT set_config('request.jwt.claim.sub', '', false);
SET ROLE anon;
DO $$
BEGIN
  UPDATE public.contractor_cards SET business_name = 'Hacked';
  RAISE EXCEPTION 'FAIL: anon renamed a contractor';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN object_not_in_prerequisite_state THEN NULL;
END $$;
DO $$
BEGIN
  UPDATE public.contractor_cards SET trades = '{}';
  RAISE EXCEPTION 'FAIL: anon wiped trades';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN object_not_in_prerequisite_state THEN NULL;
END $$;
DO $$
BEGIN
  DELETE FROM public.contractor_cards;
  RAISE EXCEPTION 'FAIL: anon deleted a contractor card';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN object_not_in_prerequisite_state THEN NULL;
END $$;
DO $$
BEGIN
  DELETE FROM public.profiles;
  RAISE EXCEPTION 'FAIL: anon deleted profiles';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SET ROLE authenticated;
DO $$
BEGIN
  UPDATE public.contractor_cards SET trades = '{}' WHERE id = '77777777-7777-4777-8777-777777777777';
  RAISE EXCEPTION 'FAIL: another contractor wiped trades';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN object_not_in_prerequisite_state THEN NULL;
END $$;
RESET ROLE;

SELECT public._assert(
  (SELECT business_name FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 'West Rand Plumbing'
  AND (SELECT trades FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = ARRAY['Plumbing']
  AND (SELECT count(*) FROM public.profiles WHERE role = 'contractor') >= 8,
  'contractor names, trades, and profiles survived the view attacks'
);

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SET ROLE authenticated;
UPDATE public.profiles SET business_name = 'Kabelo Plumbing' WHERE id = '33333333-3333-4333-8333-333333333333';
UPDATE public.profiles SET business_name = 'Stolen' WHERE id = '77777777-7777-4777-8777-777777777777';
RESET ROLE;
SELECT public._assert(
  (SELECT business_name FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333') = 'Kabelo Plumbing'
  AND (SELECT business_name FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 'West Rand Plumbing',
  'a contractor can rename only their own business'
);
UPDATE public.profiles SET business_name = 'Kabelo' WHERE id = '33333333-3333-4333-8333-333333333333';

-- ---------------------------------------------------------------------------
-- Direct calls: release, spend, ranks, notify, audit, cron, helpers
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
INSERT INTO public._t (name, id)
SELECT 'sec_hold', (public.create_job(
  'Plumbing', 'Security hold', 'Exploit target', 'Bryanston', 'Johannesburg North',
  'Soon', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SET ROLE authenticated;
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'sec_hold'), 2) ->> 'ok')::boolean,
  'a signed-in contractor can still place a bid'
);
RESET ROLE;

SELECT public._assert(
  (SELECT tokens FROM public.token_holds
    WHERE profile_id = '66666666-6666-4666-8666-666666666666'
      AND job_id = (SELECT id FROM public._t WHERE name = 'sec_hold')) = 2,
  'the bid holds 2 tokens before the attack'
);

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM public.release_hold(
    '66666666-6666-4666-8666-666666666666',
    (SELECT id FROM public._t WHERE name = 'sec_hold'),
    'keep the bid'
  );
  RAISE EXCEPTION 'FAIL: contractor released their own hold';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM public.spend_hold(
    '66666666-6666-4666-8666-666666666666',
    (SELECT id FROM public._t WHERE name = 'sec_hold')
  );
  RAISE EXCEPTION 'FAIL: rival spent the hold';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

SELECT public._assert(
  (SELECT tokens FROM public.token_holds
    WHERE profile_id = '66666666-6666-4666-8666-666666666666'
      AND job_id = (SELECT id FROM public._t WHERE name = 'sec_hold')) = 2
  AND NOT EXISTS (
    SELECT 1 FROM public.token_ledger
    WHERE note = 'keep the bid'
  ),
  'release_hold and spend_hold did not move the held tokens'
);

SELECT set_config('request.jwt.claim.sub', '', false);
SET ROLE anon;
DO $$
DECLARE
  fn_call text;
BEGIN
  FOREACH fn_call IN ARRAY ARRAY[
    'SELECT * FROM public.bid_ranks((SELECT id FROM public._t WHERE name = ''sec_hold''))',
    'SELECT public.notify(''11111111-1111-4111-8111-111111111111'', ''You won a prize'', ''Open this'', ''https://evil.example/phish'')',
    'SELECT public.audit_write(''pwned'', ''profiles'', ''11111111-1111-4111-8111-111111111111'', ''{}''::jsonb)',
    'SELECT public.close_expired_auctions()',
    'SELECT public.is_winner((SELECT id FROM public._t WHERE name = ''sec_hold''), ''66666666-6666-4666-8666-666666666666'')',
    'SELECT public.contractor_can_see_job((SELECT id FROM public._t WHERE name = ''sec_hold''))',
    'SELECT public.setting_int(''token_rand'')',
    'SELECT public.handle_new_user()',
    'SELECT public.notify_due_leads()'
  ] LOOP
    BEGIN
      EXECUTE fn_call;
      RAISE EXCEPTION 'FAIL: anon ran %', fn_call;
    EXCEPTION
      WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM * FROM public.bid_ranks((SELECT id FROM public._t WHERE name = 'sec_hold'));
  RAISE EXCEPTION 'FAIL: signed-in user read bid_ranks';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM public.is_winner(
    (SELECT id FROM public._t WHERE name = 'sec_hold'),
    '66666666-6666-4666-8666-666666666666'
  );
  RAISE EXCEPTION 'FAIL: signed-in user called is_winner';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM public.close_auction((SELECT id FROM public._t WHERE name = 'sec_hold'));
  RAISE EXCEPTION 'FAIL: signed-in user called close_auction';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

SELECT public._assert(
  NOT EXISTS (SELECT 1 FROM public.notifications WHERE title = 'You won a prize')
  AND NOT EXISTS (SELECT 1 FROM public.audit WHERE action = 'pwned'),
  'the fake notification and forged audit row were not written'
);

SELECT set_config('request.jwt.claim.sub', '', false);
SET ROLE anon;
SELECT public._assert(
  (SELECT (public.public_settings() ->> 'token_rand')::int) = 20,
  'anon can still read the public token price through the allowed RPC'
);
RESET ROLE;

UPDATE public.job_requests
SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT id FROM public._t WHERE name = 'sec_hold');
SELECT public._assert(
  public.close_expired_auctions() >= 1,
  'the owner can still close expired auctions the way pg_cron does'
);
SELECT public._assert(
  (SELECT tokens_spent FROM public.auction_results
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_hold')
      AND contractor_id = '66666666-6666-4666-8666-666666666666') = 2
  AND NOT EXISTS (
    SELECT 1 FROM public.token_holds
    WHERE profile_id = '66666666-6666-4666-8666-666666666666'
      AND job_id = (SELECT id FROM public._t WHERE name = 'sec_hold')
  ),
  'the bidder still pays their own 2 tokens when the auction closes'
);

-- Winner can still see the photo. A rival cannot. is_winner() itself stays closed.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
INSERT INTO public.request_photos (job_id, storage_path)
VALUES ((SELECT id FROM public._t WHERE name = 'sec_hold'), 'sec-hold.jpg');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.request_photos
    WHERE storage_path = 'sec-hold.jpg') = 1,
  'a winner can still see the job photo without calling is_winner'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.request_photos WHERE storage_path = 'sec-hold.jpg') = 0,
  'a contractor who did not win cannot see that photo'
);
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Post, bid, close, quote, accept. One quote only. Private threads.
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
INSERT INTO public._t (name, id)
SELECT 'sec_msg', (public.create_job(
  'Plumbing', 'Security messages', 'Private threads', 'Bryanston', 'Johannesburg North',
  'Soon', 'Client A', '0821111111', 'Gate 9'
) ->> 'id')::uuid;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SET ROLE authenticated;
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'sec_msg'), 2) ->> 'ok')::boolean, 'Lerato bids 2 on the message job');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SET ROLE authenticated;
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'sec_msg'), 3) ->> 'ok')::boolean, 'Sipho bids 3 on the message job');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
SET ROLE authenticated;
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'sec_msg'), 4) ->> 'ok')::boolean, 'Thandi bids 4 on the message job');
RESET ROLE;

UPDATE public.job_requests
SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT id FROM public._t WHERE name = 'sec_msg');
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.close_expired_auctions();
SELECT public._assert(
  (SELECT status FROM public.job_requests WHERE id = (SELECT id FROM public._t WHERE name = 'sec_msg')) = 'matched'
  AND (SELECT count(*) FROM public.auction_results WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg')) = 3
  AND (SELECT tokens_spent FROM public.auction_results
        WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg')
          AND contractor_id = '55555555-5555-4555-8555-555555555555') = 4,
  'three winners each pay their own bid'
);

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
SELECT public._assert(
  (public.send_message((SELECT id FROM public._t WHERE name = 'sec_msg'), 'no thread') ->> 'error')
    = 'choose a contractor on this job',
  'a client message has to name a contractor'
);
SELECT public._assert(
  (public.send_message(
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    'Hello Lerato',
    '66666666-6666-4666-8666-666666666666'
  ) ->> 'ok')::boolean,
  'the client can message one winner'
);
SELECT public._assert(
  (public.send_message(
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    'Hello Sipho',
    '44444444-4444-4444-8444-444444444444'
  ) ->> 'ok')::boolean,
  'the client can message a different winner'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.messages WHERE body = 'Hello Lerato') = 1
  AND (SELECT count(*) FROM public.messages WHERE body = 'Hello Sipho') = 0,
  'Lerato sees only her thread with the client'
);
SELECT public._assert(
  (public.send_message((SELECT id FROM public._t WHERE name = 'sec_msg'), 'On my way') ->> 'ok')::boolean,
  'a winner can reply on their own thread'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.messages WHERE body = 'Hello Sipho') = 1
  AND (SELECT count(*) FROM public.messages WHERE body IN ('Hello Lerato', 'On my way')) = 0,
  'Sipho cannot read Lerato''s conversation'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.messages WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg')) = 0,
  'a winner with no messages does not see the other threads'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.messages WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg')) = 3,
  'the client still sees every thread on their job'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SET ROLE authenticated;
SELECT public._assert(
  (public.save_quote(
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    100, 200, 50, 'Valve', 'Tiles', '2 days', 14
  ) ->> 'ok')::boolean,
  'a winner can send a quote'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SET ROLE authenticated;
SELECT public._assert(
  (public.save_quote(
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    300, 300, 80, 'Labour', 'Parts', '3 days', 10
  ) ->> 'ok')::boolean,
  'a second winner can send a quote'
);
RESET ROLE;

INSERT INTO public._t (name, id)
SELECT 'sec_sipho_quote', id FROM public.quotes
WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg')
  AND contractor_id = '44444444-4444-4444-8444-444444444444';

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SET ROLE authenticated;
SELECT public._assert(
  (public.accept_quote((SELECT id FROM public._t WHERE name = 'sec_sipho_quote')) ->> 'error') = 'not your request',
  'another client cannot accept the quote'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
SELECT public._assert(
  (public.accept_quote((
    SELECT id FROM public.quotes
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg')
      AND contractor_id = '44444444-4444-4444-8444-444444444444'
  )) ->> 'ok')::boolean,
  'the client accepts one quote'
);
SELECT public._assert(
  (public.accept_quote((
    SELECT id FROM public.quotes
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg')
      AND contractor_id = '66666666-6666-4666-8666-666666666666'
  )) ->> 'error') = 'quotes are closed',
  'a second quote on the same job cannot be accepted'
);
RESET ROLE;

SELECT public._assert(
  (SELECT count(*) FROM public.quotes
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg') AND status = 'accepted') = 1
  AND (SELECT status FROM public.job_requests WHERE id = (SELECT id FROM public._t WHERE name = 'sec_msg')) = 'accepted'
  AND (SELECT status FROM public.quotes
        WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg')
          AND contractor_id = '66666666-6666-4666-8666-666666666666') = 'not_selected',
  'the job has one accepted quote and is accepted'
);

-- The partial index is the backstop if a statement tries to mark two accepted.
DO $$
BEGIN
  UPDATE public.quotes SET status = 'accepted'
  WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg')
    AND contractor_id = '66666666-6666-4666-8666-666666666666';
  RAISE EXCEPTION 'FAIL: two accepted quotes were stored';
EXCEPTION
  WHEN unique_violation THEN NULL;
END $$;
SELECT public._assert(
  (SELECT count(*) FROM public.quotes
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_msg') AND status = 'accepted') = 1,
  'the database rejects a second accepted quote on the job'
);

SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = '66666666-6666-4666-8666-666666666666'
      AND title = 'Another quote was chosen'
      AND href = '#/contractor/lead/' || (SELECT id FROM public._t WHERE name = 'sec_msg')
      AND body NOT ILIKE '%http%'
  )
  AND EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = '55555555-5555-4555-8555-555555555555'
      AND title = 'Another quote was chosen'
      AND href = '#/contractor/lead/' || (SELECT id FROM public._t WHERE name = 'sec_msg')
  )
  AND EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = '44444444-4444-4444-8444-444444444444'
      AND title = 'Quote accepted'
      AND href = '#/contractor/lead/' || (SELECT id FROM public._t WHERE name = 'sec_msg')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = '44444444-4444-4444-8444-444444444444'
      AND title = 'Another quote was chosen'
      AND href = '#/contractor/lead/' || (SELECT id FROM public._t WHERE name = 'sec_msg')
  ),
  'the chosen contractor is told, and the other winners get a polite note'
);

-- The same note was sent for the quote accepted in the original flow,
-- including a winner who never sent a quote.
SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = '55555555-5555-4555-8555-555555555555'
      AND title = 'Another quote was chosen'
      AND href = '#/contractor/lead/' || (SELECT id FROM public._t WHERE name = 'job1')
  ),
  'a winner who did not quote is still told they were not chosen'
);

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SET ROLE authenticated;
SELECT public._assert(
  (public.send_message((SELECT id FROM public._t WHERE name = 'sec_msg'), 'Still here?') ->> 'error')
    = 'this conversation is closed',
  'a contractor who was not chosen cannot post after acceptance'
);
SELECT public._assert(
  (public.save_quote(
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    1, 1, 1, 'x', 'y', '1 day', 7
  ) ->> 'error') = 'quotes are closed',
  'a contractor who was not chosen cannot send another quote after acceptance'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
SET ROLE authenticated;
SELECT public._assert(
  (public.save_quote(
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    1, 1, 1, 'x', 'y', '1 day', 7
  ) ->> 'error') = 'quotes are closed',
  'quotes are closed once a quote is accepted'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
SELECT public._assert(
  (public.send_message(
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    'Sorry',
    '66666666-6666-4666-8666-666666666666'
  ) ->> 'error') = 'this conversation is closed',
  'the client cannot keep posting to a contractor who was not chosen'
);
SELECT public._assert(
  (public.send_message(
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    'See you Tuesday',
    '44444444-4444-4444-8444-444444444444'
  ) ->> 'ok')::boolean,
  'the client can still message the chosen contractor'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SET ROLE authenticated;
SELECT public._assert(
  (public.send_message((SELECT id FROM public._t WHERE name = 'sec_msg'), 'Tuesday works') ->> 'ok')::boolean,
  'the chosen contractor can still reply'
);
SELECT public._assert(
  (SELECT count(*) FROM public.messages WHERE body = 'Sorry') = 0
  AND (SELECT count(*) FROM public.messages WHERE body = 'See you Tuesday') = 1,
  'the chosen contractor does not see the closed thread'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SET ROLE authenticated;
DO $$
BEGIN
  INSERT INTO public.messages (job_id, sender_id, body, contractor_id)
  VALUES (
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    '66666666-6666-4666-8666-666666666666',
    'direct insert',
    '66666666-6666-4666-8666-666666666666'
  );
  RAISE EXCEPTION 'FAIL: direct message insert worked';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
SELECT public._assert(
  NOT EXISTS (SELECT 1 FROM public.messages WHERE body = 'direct insert'),
  'messages cannot be inserted except through send_message'
);

-- ---------------------------------------------------------------------------
-- VIP cover is one row per lead and never above 5, including a raised bid.
-- ---------------------------------------------------------------------------

SELECT public._assert(
  (SELECT count(*) FROM public.token_ledger
    WHERE profile_id = '77777777-7777-4777-8777-777777777777'
      AND job_id = (SELECT id FROM public._t WHERE name = 'job_vip')
      AND entry_type = 'vip_cover') = 1
  AND (SELECT tokens FROM public.token_ledger
    WHERE profile_id = '77777777-7777-4777-8777-777777777777'
      AND job_id = (SELECT id FROM public._t WHERE name = 'job_vip')
      AND entry_type = 'vip_cover') = 5,
  'raising the earlier VIP bid left a single cover of 5'
);

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
INSERT INTO public._t (name, id)
SELECT 'sec_vip', (public.create_job(
  'Plumbing', 'Security VIP', 'Cover once', 'Parkhurst', 'Johannesburg North',
  'Next week', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', false);
SET ROLE authenticated;
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'sec_vip'), 2) ->> 'due')::int = 0, 'VIP bid of 2 is covered');
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'sec_vip'), 4) ->> 'due')::int = 0, 'raising to 4 is still covered');
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'sec_vip'), 6) ->> 'due')::int = 1, 'raising to 6 charges 1 token');
RESET ROLE;

SELECT public._assert(
  (SELECT count(*) FROM public.token_ledger
    WHERE profile_id = '77777777-7777-4777-8777-777777777777'
      AND job_id = (SELECT id FROM public._t WHERE name = 'sec_vip')
      AND entry_type = 'vip_cover') = 1
  AND (SELECT COALESCE(sum(tokens), 0) FROM public.token_ledger
    WHERE profile_id = '77777777-7777-4777-8777-777777777777'
      AND job_id = (SELECT id FROM public._t WHERE name = 'sec_vip')
      AND entry_type = 'vip_cover') = 5,
  'three VIP bids on one lead show 5 tokens of cover, not 2+4+5'
);
SELECT public._assert(
  (SELECT token_held FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 1
  AND (SELECT token_available FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 17,
  'only the token above 5 is held'
);

UPDATE public.job_requests
SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT id FROM public._t WHERE name = 'sec_vip');
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.close_expired_auctions();
SELECT public._assert(
  (SELECT tokens_spent FROM public.auction_results
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'sec_vip')) = 1,
  'the VIP win spends the 1 held token, not the covered 5'
);

-- ---------------------------------------------------------------------------
-- Sign-up trigger and an admin read still work.
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT INSERT ON auth.users TO supabase_auth_admin;
SET ROLE supabase_auth_admin;
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'newco-sec@example.com',
  '{"role":"contractor","full_name":"New Security Co"}'
);
RESET ROLE;
SELECT public._assert(
  (SELECT role FROM public.profiles WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') = 'contractor',
  'a new sign-up still creates a contractor profile'
);

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SET ROLE authenticated;
SELECT public._assert(public.admin_snapshot() ? 'jobs', 'an admin can still open the admin screen');
SELECT public._assert(
  (SELECT count(*) FROM public.job_requests WHERE id = (SELECT id FROM public._t WHERE name = 'sec_msg')) = 1,
  'an admin can still read a client job'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT label FROM public.bid_board((SELECT id FROM public._t WHERE name = 'sec_hold')) WHERE is_you) = 'You',
  'the bid board still labels your own bid and hides the other names'
);
RESET ROLE;

-- Rows written before this migration had no contractor. Re-applying the
-- script must put each one on a single thread.
ALTER TABLE public.messages ALTER COLUMN contractor_id DROP NOT NULL;
INSERT INTO public.messages (job_id, sender_id, body)
VALUES
  (
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    '66666666-6666-4666-8666-666666666666',
    'legacy from lerato'
  ),
  (
    (SELECT id FROM public._t WHERE name = 'sec_msg'),
    '11111111-1111-4111-8111-111111111111',
    'legacy from client'
  );

\i 03_apply_security_migration.sql

SELECT public._assert(
  (SELECT contractor_id FROM public.messages WHERE body = 'legacy from lerato')
    = '66666666-6666-4666-8666-666666666666'
  AND (SELECT count(*) FROM public.messages WHERE body = 'legacy from lerato') = 1
  AND (SELECT contractor_id FROM public.messages WHERE body = 'legacy from client')
    = '44444444-4444-4444-8444-444444444444'
  AND (SELECT count(*) FROM public.messages WHERE body = 'legacy from client') = 1,
  'older shared messages are split onto one contractor thread'
);

SELECT 'SECURITY TESTS PASSED' AS result;
