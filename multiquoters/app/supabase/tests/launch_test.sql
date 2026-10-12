-- Checks added by the launch migration: stable bid labels, line-item quotes,
-- contact hiding after acceptance, stored consent, and one review per job.
-- Runs after rpc_test.sql and security_test.sql, on the same database.

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);
GRANT SELECT ON public._t TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public._assert(boolean, text) TO authenticated, anon;

SELECT public._assert(public.format_rand(1850) = 'R1,850', 'rands use a thousands comma');
SELECT public._assert(public.format_rand(20) = 'R20', 'small amounts have no comma');
SELECT public._assert(public.ordinal_en(1) = '1st' AND public.ordinal_en(2) = '2nd' AND public.ordinal_en(3) = '3rd' AND public.ordinal_en(11) = '11th', 'ordinals read naturally');

SELECT public._assert(
  (SELECT label FROM public.bid_aliases
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job1')
      AND contractor_id = '33333333-3333-4333-8333-333333333333') = 'Contractor A'
  AND (SELECT label FROM public.bid_aliases
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job1')
      AND contractor_id = '44444444-4444-4444-8444-444444444444') = 'Contractor B',
  'the first bidder stays Contractor A and the second stays Contractor B'
);

SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT anon FROM public.bid_board((SELECT id FROM public._t WHERE name = 'job1')) WHERE is_you) = 'Contractor B'
  AND (SELECT label FROM public.bid_board((SELECT id FROM public._t WHERE name = 'job1')) WHERE is_you) = 'You'
  AND EXISTS (
    SELECT 1 FROM public.bid_board((SELECT id FROM public._t WHERE name = 'job1'))
    WHERE anon = 'Contractor A' AND NOT is_you
  ),
  'both viewers share the same anonymous letter'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT anon FROM public.bid_board((SELECT id FROM public._t WHERE name = 'job1')) WHERE is_you) = 'Contractor A',
  'the first bidder still sees their own letter as Contractor A'
);
SELECT public._assert(
  (SELECT count(*) FROM public.unlocked_contacts((SELECT id FROM public._t WHERE name = 'job1')) WHERE who = 'client') = 1,
  'the plumber whose quote was accepted still sees the client'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.unlocked_contacts((SELECT id FROM public._t WHERE name = 'job1')) WHERE who = 'client') = 0,
  'a plumber who was not chosen no longer sees the client phone'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
SELECT public._assert(
  (SELECT count(*) FROM public.unlocked_contacts((SELECT id FROM public._t WHERE name = 'job1')) WHERE who = 'contractor') = 1
  AND (SELECT person_id FROM public.unlocked_contacts((SELECT id FROM public._t WHERE name = 'job1')) WHERE who = 'contractor')
      = '33333333-3333-4333-8333-333333333333',
  'the client only keeps the chosen plumber phone'
);
SELECT public._assert(
  (public.submit_review(
    (SELECT id FROM public._t WHERE name = 'job1'),
    '33333333-3333-4333-8333-333333333333',
    4, 'Again'
  ) ->> 'error') = 'already reviewed',
  'a client can leave only one review on a job'
);
RESET ROLE;

SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = '33333333-3333-4333-8333-333333333333'
      AND title = 'Bid placed'
      AND body LIKE '%1st of 1%'
      AND body LIKE '%only pay%'
  ),
  'a bid confirmation says the place and that you only pay in the top 3'
);
SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE title = 'Quote received'
      AND body LIKE '%Kabelo quoted R2,350.%'
  ),
  'a quote alert names the contractor and the amount'
);
SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE title = 'You won a place'
      AND href LIKE '#/contractor/quote/%'
      AND body LIKE '%Send your quote%'
  ),
  'the win alert points at sending a quote'
);

SELECT set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', false);
SELECT public._assert(
  (public.save_quote_lines(
    (SELECT id FROM public._t WHERE name = 'job_vip'),
    '[
      {"description":"Valve","qty":2,"unit_rand":400,"kind":"material"},
      {"description":"Labour","qty":1.5,"unit_rand":600,"kind":"labour"}
    ]'::jsonb,
    'New valve fitted',
    'Wall tiles',
    '2 days',
    14
  ) ->> 'ok')::boolean,
  'a winner can send a line-item quote'
);
SELECT public._assert(
  (SELECT materials_rand FROM public.quotes
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job_vip')) = 800
  AND (SELECT labour_rand FROM public.quotes
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job_vip')) = 900
  AND (SELECT qty FROM public.quote_items qi
    JOIN public.quotes q ON q.id = qi.quote_id
    WHERE q.job_id = (SELECT id FROM public._t WHERE name = 'job_vip')
      AND qi.label = 'Valve') = 2,
  'line totals roll up and the quantity is stored'
);
SELECT public._assert(
  (public.save_quote_lines(
    (SELECT id FROM public._t WHERE name = 'job_vip'),
    '[{"description":"Call-out","qty":1,"unit_rand":350,"kind":"callout"}]'::jsonb,
    'Visit included',
    'Parts',
    'Same day',
    7
  ) ->> 'updated')::boolean,
  'the same winner can update the quote while it is open'
);
SELECT public._assert(
  NOT EXISTS (
    SELECT 1 FROM public.quote_items qi
    JOIN public.quotes q ON q.id = qi.quote_id
    WHERE q.job_id = (SELECT id FROM public._t WHERE name = 'job_vip')
      AND qi.label = 'Valve'
  )
  AND (SELECT callout_rand FROM public.quotes
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job_vip')) = 350,
  'editing replaces the old lines'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SELECT public._assert(
  (public.save_quote_lines(
    (SELECT id FROM public._t WHERE name = 'job_vip'),
    '[{"description":"Nope","qty":1,"unit_rand":10,"kind":"other"}]'::jsonb,
    'x', 'y', '1 day', 7
  ) ->> 'error') = 'only winners can quote',
  'someone outside the top 3 cannot send line items'
);

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT public._assert(
  (public.accept_quote((
    SELECT id FROM public.quotes
    WHERE job_id = (SELECT id FROM public._t WHERE name = 'job_vip')
  )) ->> 'ok')::boolean,
  'the client can accept the line-item quote'
);
SELECT set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', false);
SELECT public._assert(
  (public.save_quote_lines(
    (SELECT id FROM public._t WHERE name = 'job_vip'),
    '[{"description":"Late","qty":1,"unit_rand":10,"kind":"other"}]'::jsonb,
    'x', 'y', '1 day', 7
  ) ->> 'error') = 'quotes are closed',
  'a quote cannot be edited after it is accepted'
);

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT public._assert(
  (public.create_job(
    'Plumbing', 'Should fail', 'Nope', 'Bryanston', 'Johannesburg North',
    'This week', 'Kabelo', '0820000001', NULL
  ) ->> 'error') = 'clients only',
  'a contractor cannot post a job'
);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO public._t (name, id)
SELECT 'launch_open', (public.create_job(
  'Plumbing', 'Open lead', 'Tap', 'Bryanston', 'Johannesburg North',
  'This week', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'launch_open'), 1) ->> 'error') = 'contractors only',
  'an admin cannot bid'
);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  '12121212-1212-4121-8121-121212121212',
  'consent@example.com',
  '{"role":"client","full_name":"Consent Client","terms_accepted_at":"2026-10-12T12:00:00Z"}'
);
SELECT public._assert(
  (SELECT terms_accepted_at FROM public.profiles WHERE id = '12121212-1212-4121-8121-121212121212')
    = '2026-10-12T12:00:00Z',
  'sign-up stores the terms consent time'
);

SELECT public._assert(
  NOT has_function_privilege('anon', 'public.save_quote_lines(uuid, jsonb, text, text, text, integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.ordinal_en(integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.format_rand(integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.assign_bid_alias()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.save_quote_lines(uuid, jsonb, text, text, text, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.bid_board(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.unlocked_contacts(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.place_bid(uuid, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.save_quote(uuid, integer, integer, integer, text, text, text, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.my_profile()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.close_auction(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.place_bid(uuid, integer)', 'EXECUTE')
  AND NOT has_table_privilege('authenticated', 'public.bid_aliases', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.contractor_cards', 'UPDATE'),
  'new internal functions stay locked and the new quote RPC is callable'
);

SELECT 'LAUNCH TESTS PASSED' AS result;
