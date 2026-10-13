-- Unit tests for bids, closes, VIP cover, and row level security.
-- Runs as a superuser against a database where 00_local_auth.sql and the migrations are applied.

CREATE OR REPLACE FUNCTION public._assert(ok boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(ok, false) THEN
    RAISE EXCEPTION 'FAIL: %', msg;
  END IF;
  RAISE NOTICE 'ok: %', msg;
END;
$$;

-- The security migration stops new public functions being granted to the API
-- roles. This helper is part of the test, not the app.
GRANT EXECUTE ON FUNCTION public._assert(boolean, text) TO authenticated, anon;

CREATE TABLE IF NOT EXISTS public._t (
  name text PRIMARY KEY,
  id uuid
);
GRANT SELECT ON public._t TO authenticated, anon;
TRUNCATE public._t;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-4111-8111-111111111111', 'clienta@example.com', '{"role":"client","full_name":"Client A"}'),
  ('22222222-2222-4222-8222-222222222222', 'clientb@example.com', '{"role":"client","full_name":"Client B"}'),
  ('33333333-3333-4333-8333-333333333333', 'c1@example.com', '{"role":"contractor","full_name":"Kabelo"}'),
  ('44444444-4444-4444-8444-444444444444', 'c2@example.com', '{"role":"contractor","full_name":"Sipho"}'),
  ('55555555-5555-4555-8555-555555555555', 'c3@example.com', '{"role":"contractor","full_name":"Thandi"}'),
  ('66666666-6666-4666-8666-666666666666', 'c4@example.com', '{"role":"contractor","full_name":"Lerato"}'),
  ('77777777-7777-4777-8777-777777777777', 'elize@example.com', '{"role":"contractor","full_name":"Elize"}'),
  ('88888888-8888-4888-8888-888888888888', 'newco@example.com', '{"role":"contractor","full_name":"Unverified"}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@example.com', '{"role":"admin","full_name":"Owner"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'race@example.com', '{"role":"contractor","full_name":"Race"}'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'paint@example.com', '{"role":"contractor","full_name":"Painter"}'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'poor@example.com', '{"role":"contractor","full_name":"Poor"}');

SELECT public._assert(
  (SELECT role FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 'client',
  'signup cannot choose admin'
);
SELECT public._assert(
  (SELECT user_code FROM public.profiles WHERE id = '11111111-1111-4111-8111-111111111111') = 'MQ-11111111',
  'user code is MQ- plus the first 8 id characters'
);

UPDATE public.profiles SET role = 'admin' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE public.profiles SET
  verified = true,
  trades = ARRAY['Plumbing'],
  areas = ARRAY['Johannesburg North'],
  phone = '0820000001',
  token_available = 100
WHERE id IN (
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666'
);
UPDATE public.profiles SET
  verified = true,
  trades = ARRAY['Plumbing'],
  areas = ARRAY['Johannesburg North'],
  phone = '0820000007',
  token_available = 20,
  business_name = 'West Rand Plumbing',
  vip_until = now() + interval '1 year'
WHERE id = '77777777-7777-4777-8777-777777777777';
UPDATE public.profiles SET
  verified = true,
  trades = ARRAY['Plumbing'],
  areas = ARRAY['Johannesburg North'],
  phone = '0820000009',
  token_available = 3
WHERE id IN (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
);
UPDATE public.profiles SET
  verified = true,
  trades = ARRAY['Painting'],
  areas = ARRAY['Johannesburg North'],
  token_available = 50
WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
UPDATE public.profiles SET
  trades = ARRAY['Plumbing'],
  areas = ARRAY['Johannesburg North'],
  token_available = 50
WHERE id = '88888888-8888-4888-8888-888888888888';

-- Existing bid tests predate trade registration. A current PIRB row keeps
-- those bids on the same money rules. The unverified contractor is left out.
INSERT INTO public.contractor_registrations (
  profile_id, trade, body_code, registration_number, expires_on, proof_path, status, reviewed_at
)
SELECT p.id, 'Plumbing', 'pirb', 'TEST-' || left(replace(p.id::text, '-', ''), 8),
       current_date + 400, p.id::text || '/registration/pirb-test.jpg', 'verified', now()
FROM public.profiles p
WHERE p.verified
  AND 'Plumbing' = ANY (p.trades)
  AND NOT EXISTS (
    SELECT 1 FROM public.contractor_registrations r
    WHERE r.profile_id = p.id AND r.trade = 'Plumbing' AND r.body_code = 'pirb' AND r.status = 'verified'
  );

SELECT public._assert(public.setting_int('token_rand') = 20, 'token price is R20');
SELECT public._assert(public.setting_int('vip_free_tokens') = 5, 'VIP covers 5 tokens');
SELECT public._assert(public.setting_int('places') = 3, 'top 3 places');

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

INSERT INTO public._t (name, id)
SELECT 'job1', (public.create_job(
  'Plumbing', 'Leaking geyser', 'The geyser drips', 'Bryanston', 'Johannesburg North',
  'This week', 'Client A', '0821111111', 'Gate code 1234'
) ->> 'id')::uuid;

INSERT INTO public._t (name, id)
SELECT 'job_b', (public.create_job(
  'Plumbing', 'Blocked drain', 'Kitchen drain', 'Morningside', 'Johannesburg North',
  'Tomorrow', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
INSERT INTO public._t (name, id)
SELECT 'job_other', (public.create_job(
  'Plumbing', 'Other client tap', 'Drip', 'Sandton', 'Johannesburg North',
  'Today', 'Client B', '0832222222', 'Secret note'
) ->> 'id')::uuid;

SELECT public._assert(
  (SELECT count(*) FROM public.notifications n
    WHERE n.profile_id = '77777777-7777-4777-8777-777777777777'
      AND n.title = 'VIP early access') >= 1,
  'VIP contractors are alerted when a matching lead is posted'
);
SELECT public._assert(
  NOT EXISTS (
    SELECT 1 FROM public.lead_notifications
    WHERE profile_id = '33333333-3333-4333-8333-333333333333'
  ),
  'non-VIP contractors are not alerted at the moment a lead is posted'
);

-- Bids: 1, 2, 3 then a 4th must beat 3rd place.
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'job1'), 1) ->> 'ok')::boolean, 'first bid of 1 is accepted');
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'job1'), 2) ->> 'ok')::boolean, 'second bid of 2 is accepted');
SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'job1'), 3) ->> 'ok')::boolean, 'third bid of 3 is accepted');

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SELECT public._assert(
  (public.preview_bid((SELECT id FROM public._t WHERE name = 'job1'), NULL) ->> 'min')::int = 2,
  'with 3 bids the minimum is 3rd place plus 1'
);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'job1'), 1) ->> 'error') = 'bid too low',
  'a bid below the minimum is rejected'
);
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'job1'), 2) ->> 'ok')::boolean, 'bid of 2 ties 3rd and takes the later place');

SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333') = 100
  AND (SELECT token_held FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333') = 0,
  'the contractor pushed out of the top 3 is released'
);
SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.token_ledger
    WHERE profile_id = '33333333-3333-4333-8333-333333333333'
      AND entry_type = 'release' AND tokens = 1 AND rand = 20
  ),
  'a released hold is written as R20 per token'
);

-- Kabelo buys back in at 3, which pushes Lerato (the later 2) out.
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT public._assert(
  (public.preview_bid((SELECT id FROM public._t WHERE name = 'job1'), NULL) ->> 'min')::int = 3,
  'an outbid contractor must beat the current 3rd place'
);
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'job1'), 3) ->> 'ok')::boolean, 'rebid of 3 is accepted');
SELECT public._assert(
  (SELECT token_held FROM public.profiles WHERE id = '66666666-6666-4666-8666-666666666666') = 0
  AND (SELECT token_available FROM public.profiles WHERE id = '66666666-6666-4666-8666-666666666666') = 100,
  'the later tie is released when a higher bid arrives'
);

SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
SELECT public._assert(
  (SELECT label FROM public.bid_board((SELECT id FROM public._t WHERE name = 'job1')) WHERE is_you) = 'You',
  'your own bid is labelled You'
);
SELECT public._assert(
  NOT EXISTS (
    SELECT 1 FROM public.bid_board((SELECT id FROM public._t WHERE name = 'job1'))
    WHERE label ILIKE '%kabelo%' OR label ILIKE '%thandi%' OR label ILIKE '%sipho%'
  ),
  'other bids stay anonymised'
);

-- Close and pay.
UPDATE public.job_requests
SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT id FROM public._t WHERE name = 'job1');
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public._assert(
  (public.close_auction((SELECT id FROM public._t WHERE name = 'job1')) ->> 'winners')::int = 3,
  'close pays the top 3'
);
SELECT public._assert(
  (SELECT status FROM public.job_requests WHERE id = (SELECT id FROM public._t WHERE name = 'job1')) = 'matched',
  'a decided auction is matched'
);
SELECT public._assert(
  (SELECT count(*) FROM public.auction_results WHERE job_id = (SELECT id FROM public._t WHERE name = 'job1')) = 3,
  'three auction results'
);
SELECT public._assert(
  (SELECT tokens_spent FROM public.auction_results
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job1')
      AND contractor_id = '33333333-3333-4333-8333-333333333333') = 3,
  'each winner pays their own bid'
);
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333') = 97
  AND (SELECT token_held FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333') = 0,
  'a winning hold is spent, not returned'
);
SELECT public._assert(
  (public.close_auction((SELECT id FROM public._t WHERE name = 'job1')) ->> 'already')::boolean,
  'closing again is idempotent'
);
SELECT public._assert(
  (SELECT count(*) FROM public.token_ledger
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job1') AND entry_type = 'spend') = 3,
  'a second close does not spend again'
);

-- Contact and photos unlock only for winners.
INSERT INTO public.request_photos (job_id, storage_path)
VALUES ((SELECT id FROM public._t WHERE name = 'job1'), 'photo-1.jpg');
INSERT INTO public.request_photos (job_id, storage_path)
VALUES ((SELECT id FROM public._t WHERE name = 'job_b'), 'secret-photo.jpg');

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT phone FROM public.unlocked_contacts((SELECT id FROM public._t WHERE name = 'job1')) WHERE who = 'client') = '0821111111',
  'a winner can see the client phone'
);
SELECT public._assert(
  (SELECT count(*) FROM public.request_photos WHERE job_id = (SELECT id FROM public._t WHERE name = 'job1')) = 1,
  'a winner can see job photos'
);
SELECT public._assert(
  (SELECT count(*) FROM public.request_photos WHERE job_id = (SELECT id FROM public._t WHERE name = 'job_b')) = 0,
  'a contractor cannot see photos before winning'
);
SELECT public._assert(
  (SELECT count(*) FROM public.request_private) = 0,
  'client contact is not a column contractors can select'
);
SELECT public._assert(
  (SELECT count(*) FROM public.job_requests WHERE id = (SELECT id FROM public._t WHERE name = 'job_other')) = 1,
  'a matching contractor can see another client lead teaser'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.job_requests) = 2,
  'a client sees only their own requests'
);
SELECT public._assert(
  (SELECT count(*) FROM public.request_private WHERE phone = '0832222222') = 0,
  'a client cannot read another client phone'
);
SELECT public._assert(
  (SELECT count(*) FROM public.quotes) = 0,
  'a client has no quotes until someone sends one'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SET ROLE authenticated;
SELECT public._assert(
  NOT EXISTS (SELECT 1 FROM public.job_requests WHERE title = 'Leaking geyser'),
  'client B cannot see client A requests'
);
RESET ROLE;

-- Quotes, accept, review.
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT public._assert(
  (public.save_quote(
    (SELECT id FROM public._t WHERE name = 'job1'),
    800, 1200, 350, 'New valve', 'Tiles', '2 days', 14
  ) ->> 'ok')::boolean,
  'a winner can send one quote'
);
SELECT public._assert(
  (public.save_quote(
    (SELECT id FROM public._t WHERE name = 'job1'),
    1, 1, 1, 'x', 'y', '1 day', 7
  ) ->> 'error') = 'you already sent a quote',
  'a second quote from the same winner is rejected'
);
SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SELECT public._assert(
  (public.save_quote(
    (SELECT id FROM public._t WHERE name = 'job1'),
    1, 1, 1, 'x', 'y', '1 day', 7
  ) ->> 'error') = 'only winners can quote',
  'someone who missed the top 3 cannot quote'
);

SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SELECT public.save_quote(
  (SELECT id FROM public._t WHERE name = 'job1'),
  500, 500, 100, 'Labour only', 'Parts', '3 days', 10
);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT public._assert(
  (SELECT count(*) FROM public.quotes WHERE job_id = (SELECT id FROM public._t WHERE name = 'job1')) = 2,
  'the client can see the quotes on their request'
);
SELECT public._assert(
  (public.submit_review(
    (SELECT id FROM public._t WHERE name = 'job1'),
    '33333333-3333-4333-8333-333333333333',
    5, 'Great'
  ) ->> 'error') = 'you can review only an accepted quote',
  'a review before acceptance is rejected'
);

SELECT public._assert(
  (public.accept_quote((
    SELECT id FROM public.quotes
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job1')
      AND contractor_id = '33333333-3333-4333-8333-333333333333'
  )) ->> 'ok')::boolean,
  'the client can accept one quote'
);
SELECT public._assert(
  (SELECT status FROM public.quotes
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job1')
      AND contractor_id = '44444444-4444-4444-8444-444444444444') = 'not_selected',
  'the other quote is not selected'
);
SELECT public._assert(
  (public.submit_review(
    (SELECT id FROM public._t WHERE name = 'job1'),
    '33333333-3333-4333-8333-333333333333',
    5, 'Great'
  ) ->> 'ok')::boolean,
  'the client can review the accepted contractor'
);
SELECT public._assert(
  (public.submit_review(
    (SELECT id FROM public._t WHERE name = 'job1'),
    '44444444-4444-4444-8444-444444444444',
    1, 'No'
  ) ->> 'error') = 'you can review only an accepted quote',
  'a review of a losing quote is rejected'
);

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.quotes) = 0,
  'another client cannot see these quotes'
);
RESET ROLE;

-- VIP: 5 tokens cost nothing, 7 tokens cost 2.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO public._t (name, id)
SELECT 'job_vip', (public.create_job(
  'Plumbing', 'Garden tap', 'Outside tap', 'Parkhurst', 'Johannesburg North',
  'Next week', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;

SELECT set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'job_vip'), 5) ->> 'due')::int = 0,
  'a VIP bid of 5 costs 0 tokens'
);
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 20
  AND (SELECT token_held FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 0,
  'a covered VIP bid does not hold tokens'
);
SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.token_ledger
    WHERE profile_id = '77777777-7777-4777-8777-777777777777'
      AND entry_type = 'vip_cover' AND rand = 0 AND note = 'R0 (VIP)'
  ),
  'the covered part is recorded as R0 (VIP)'
);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'job_vip'), 7) ->> 'due')::int = 2,
  'a VIP bid of 7 charges the 2 tokens above 5'
);
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 18
  AND (SELECT token_held FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 2,
  'only the tokens above 5 are held'
);
UPDATE public.job_requests SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT id FROM public._t WHERE name = 'job_vip');
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.close_auction((SELECT id FROM public._t WHERE name = 'job_vip'));
SELECT public._assert(
  (SELECT tokens_spent FROM public.auction_results
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job_vip')) = 2,
  'VIP pays the held difference when they win'
);
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 18
  AND (SELECT token_held FROM public.profiles WHERE id = '77777777-7777-4777-8777-777777777777') = 0,
  'the VIP win spends the hold and leaves the covered tokens untouched'
);
SELECT public._assert(
  (public.close_auction((SELECT id FROM public._t WHERE name = 'job_vip')) ->> 'already')::boolean,
  'VIP close is idempotent'
);

-- Rules that reject a bid.
SELECT set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'job_b'), 1) ->> 'error') = 'verification required',
  'an unverified contractor cannot bid'
);
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'job_b'), 1) ->> 'error') = 'trade does not match',
  'a painter cannot bid on plumbing'
);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'job_b'), 1) ->> 'error') = 'contractors only',
  'a client cannot bid'
);

-- Not enough tokens, without writing the bid.
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', false);
SELECT public._assert((public.place_bid((SELECT id FROM public._t WHERE name = 'job_b'), 3) ->> 'ok')::boolean, 'poor contractor spends their 3 tokens');
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'job_other'), 3) ->> 'error') = 'not enough tokens',
  'a second bid is rejected when the wallet is held'
);
SELECT public._assert(
  (SELECT count(*) FROM public.bids WHERE contractor_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') = 1,
  'a rejected bid is not stored'
);
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') = 0
  AND (SELECT token_held FROM public.profiles WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') = 3,
  'the successful hold is the only movement'
);

-- Expired auction with bidders closes inside place_bid and does not take the new bid.
UPDATE public.job_requests SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT id FROM public._t WHERE name = 'job_b');
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'job_b'), 4) ->> 'error') = 'auction closed',
  'bidding on an expired auction closes it instead'
);
SELECT public._assert(
  (SELECT status FROM public.job_requests WHERE id = (SELECT id FROM public._t WHERE name = 'job_b')) = 'matched',
  'the expired auction is matched'
);
SELECT public._assert(
  NOT EXISTS (
    SELECT 1 FROM public.bids
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job_b')
      AND contractor_id = '44444444-4444-4444-8444-444444444444'
  ),
  'the late bid is not stored'
);

-- Empty auctions extend twice, then close.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO public._t (name, id)
SELECT 'job_empty', (public.create_job(
  'Plumbing', 'No bids yet', 'Quiet job', 'Rosebank', 'Johannesburg North',
  'Soon', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;
SELECT set_config('request.jwt.claim.sub', '', false);
UPDATE public.job_requests SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT id FROM public._t WHERE name = 'job_empty');
SELECT public._assert((public.close_auction((SELECT id FROM public._t WHERE name = 'job_empty')) ->> 'extended')::boolean, 'first empty close extends');
UPDATE public.job_requests SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT id FROM public._t WHERE name = 'job_empty');
SELECT public._assert((public.close_auction((SELECT id FROM public._t WHERE name = 'job_empty')) ->> 'extended')::boolean, 'second empty close extends');
UPDATE public.job_requests SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT id FROM public._t WHERE name = 'job_empty');
SELECT public._assert(
  (public.close_auction((SELECT id FROM public._t WHERE name = 'job_empty')) ->> 'winners')::int = 0,
  'third empty close finishes with no winners'
);
SELECT public._assert(
  (SELECT status FROM public.job_requests WHERE id = (SELECT id FROM public._t WHERE name = 'job_empty')) = 'closed',
  'an empty auction eventually closes'
);

-- The minute job closes whatever is already expired, and running it twice is safe.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO public._t (name, id)
SELECT 'job_cron', (public.create_job(
  'Plumbing', 'Cron lead', 'Old', 'Bryanston', 'Johannesburg North',
  'Soon', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT public.place_bid((SELECT id FROM public._t WHERE name = 'job_cron'), 1);
UPDATE public.job_requests SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT id FROM public._t WHERE name = 'job_cron');
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public._assert(public.close_expired_auctions() >= 1, 'the minute job closes expired auctions');
SELECT public._assert(
  (SELECT status FROM public.job_requests WHERE id = (SELECT id FROM public._t WHERE name = 'job_cron')) = 'matched',
  'the cron lead is matched'
);
SELECT public._assert(public.close_expired_auctions() >= 0, 'the minute job can run again');
SELECT public._assert(
  (SELECT count(*) FROM public.auction_results WHERE job_id = (SELECT id FROM public._t WHERE name = 'job_cron')) = 1,
  'running the minute job twice does not charge twice'
);

-- Non-VIP alert after 15 minutes, once.
UPDATE public.job_requests SET created_at = now() - interval '20 minutes'
WHERE id = (SELECT id FROM public._t WHERE name = 'job_cron');
-- job_cron is matched, so it should not alert. Use a fresh open lead.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO public._t (name, id)
SELECT 'job_alert', (public.create_job(
  'Plumbing', 'Delayed alert', 'Wait', 'Bryanston', 'Johannesburg North',
  'Soon', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;
UPDATE public.job_requests SET created_at = now() - interval '20 minutes'
WHERE id = (SELECT id FROM public._t WHERE name = 'job_alert');
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public._assert(public.notify_due_leads() >= 1, 'non-VIP contractors are alerted after 15 minutes');
SELECT public._assert(
  public.notify_due_leads() = 0,
  'the same lead is not alerted twice'
);

-- Admin credit, VIP, verify, flag.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  BEGIN
    PERFORM public.grant_tokens('33333333-3333-4333-8333-333333333333', 10, 'EFT');
    RAISE EXCEPTION 'FAIL: contractor granted tokens';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%admin only%' THEN
      RAISE;
    END IF;
  END;
END $$;
SELECT public._assert(true, 'a contractor cannot grant tokens');

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SELECT public._assert(
  (public.grant_tokens('33333333-3333-4333-8333-333333333333', 10, 'EFT MQ-33333333') ->> 'ok')::boolean,
  'an admin can credit tokens'
);
SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.token_ledger
    WHERE profile_id = '33333333-3333-4333-8333-333333333333'
      AND entry_type = 'grant' AND tokens = 10 AND rand = 200
  ),
  'a grant is R20 per token'
);
SELECT public._assert(
  (public.mark_vip('77777777-7777-4777-8777-777777777777', 'yearly') ->> 'ok')::boolean,
  'an admin can mark VIP'
);
SELECT public._assert(
  (public.verify_contractor('88888888-8888-4888-8888-888888888888', true) ->> 'ok')::boolean,
  'an admin can verify a contractor'
);
SELECT public._assert(
  (SELECT verified FROM public.profiles WHERE id = '88888888-8888-4888-8888-888888888888'),
  'verification flag is stored'
);
SELECT public._assert(public.admin_snapshot() ? 'jobs', 'admin snapshot lists leads and contractors');

-- Flag releases the hold and hides the lead.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO public._t (name, id)
SELECT 'job_fake', (public.create_job(
  'Plumbing', 'Fake lead', 'Not real', 'Bryanston', 'Johannesburg North',
  'Soon', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SELECT public.place_bid((SELECT id FROM public._t WHERE name = 'job_fake'), 4);
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SELECT public._assert(
  (public.flag_job((SELECT id FROM public._t WHERE name = 'job_fake'), 'not a real job') ->> 'ok')::boolean,
  'an admin can flag a lead'
);
SELECT public._assert(
  (SELECT token_held FROM public.profiles WHERE id = '44444444-4444-4444-8444-444444444444') = 0,
  'flagging a lead releases holds'
);
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SET ROLE authenticated;
SELECT public._assert(
  NOT EXISTS (
    SELECT 1 FROM public.job_requests WHERE id = (SELECT id FROM public._t WHERE name = 'job_fake')
  ),
  'a flagged lead disappears from the contractor feed'
);
RESET ROLE;

-- API clients cannot edit bids, ledgers, or balances.
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SET ROLE authenticated;
DO $$
BEGIN
  UPDATE public.bids SET amount = 99;
  RAISE EXCEPTION 'FAIL: bid update succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
SELECT public._assert(true, 'nobody can edit bids through the API');

DO $$
BEGIN
  INSERT INTO public.token_ledger (profile_id, entry_type, tokens, rand, note)
  VALUES ('33333333-3333-4333-8333-333333333333', 'grant', 100, 0, 'forged');
  RAISE EXCEPTION 'FAIL: ledger insert succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
SELECT public._assert(true, 'nobody can write the token ledger through the API');

DO $$
BEGIN
  PERFORM public.close_expired_auctions();
  RAISE EXCEPTION 'FAIL: minute job was public';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
SELECT public._assert(true, 'the minute job is not callable by signed-in users');
RESET ROLE;

GRANT UPDATE (token_available, role) ON public.profiles TO authenticated;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('mq.internal', '1', true);
  UPDATE public.profiles SET token_available = 9999, role = 'admin'
  WHERE id = '33333333-3333-4333-8333-333333333333';
  RAISE EXCEPTION 'FAIL: profile balances changed';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT ILIKE '%protected profile field%' THEN
    RAISE;
  END IF;
END $$;
SELECT public._assert(true, 'signed-in users cannot change balances or role, even if they set a session flag');
RESET ROLE;
REVOKE UPDATE (token_available, role) ON public.profiles FROM authenticated;
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333') <> 9999,
  'balances stayed at the real figure'
);
SELECT public._assert(
  (SELECT role FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333') = 'contractor',
  'role stayed contractor'
);

-- Messages open after the auction.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT public._assert(
  (public.send_message(
    (SELECT id FROM public._t WHERE name = 'job1'),
    'Thanks, see you Tuesday',
    '33333333-3333-4333-8333-333333333333'
  ) ->> 'ok')::boolean,
  'client can message the accepted contractor'
);

-- Race fixtures: one contractor, 3 tokens, two open jobs.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO public._t (name, id)
SELECT 'race_job_1', (public.create_job(
  'Plumbing', 'Race one', 'A', 'Bryanston', 'Johannesburg North',
  'Soon', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;
INSERT INTO public._t (name, id)
SELECT 'race_job_2', (public.create_job(
  'Plumbing', 'Race two', 'B', 'Bryanston', 'Johannesburg North',
  'Soon', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;

SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public._assert(
  (SELECT token_available FROM public.profiles WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 3
  AND (SELECT count(*) FROM public.bids WHERE contractor_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 0,
  'race contractor starts with 3 tokens and no bids'
);

SELECT 'ALL SQL TESTS PASSED' AS result;
