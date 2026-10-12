-- Rank-drop alerts. Runs after 20261012210000_retest_fixes.sql.
-- Money movement stays the same: a plumber who leaves the top 3 is released,
-- and a plumber who only slips from 1st to 2nd keeps their hold.

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);

UPDATE public.profiles
SET token_available = token_available + 40
WHERE id IN (
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666'
);

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO public._t (name, id)
SELECT 'rank_job', (public.create_job(
  'Plumbing', 'Rank drop', 'Tap', 'Bryanston', 'Johannesburg North',
  'This week', 'Client A', '0821111111', NULL
) ->> 'id')::uuid;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'rank_job'), 5) ->> 'ok')::boolean,
  'the first plumber bids 5'
);
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'rank_job'), 4) ->> 'ok')::boolean,
  'the second plumber bids 4'
);
SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'rank_job'), 6) ->> 'ok')::boolean,
  'a higher bid moves the leader from 1st to 2nd'
);
SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = '33333333-3333-4333-8333-333333333333'
      AND title = 'Your place dropped'
      AND body LIKE '%1st to 2nd%'
      AND body LIKE '%still in the top 3%'
      AND href = '#/contractor/lead/' || (SELECT id FROM public._t WHERE name = 'rank_job')
  ),
  'a plumber who slips from 1st to 2nd is told'
);
SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.token_holds
    WHERE profile_id = '33333333-3333-4333-8333-333333333333'
      AND job_id = (SELECT id FROM public._t WHERE name = 'rank_job')
      AND tokens = 5
  ),
  'slipping inside the top 3 does not release the hold'
);

SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
SELECT public._assert(
  (public.place_bid((SELECT id FROM public._t WHERE name = 'rank_job'), 7) ->> 'ok')::boolean,
  'a fourth bid pushes someone out of the top 3'
);
SELECT public._assert(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = '44444444-4444-4444-8444-444444444444'
      AND title = 'You dropped out of the top 3'
      AND body LIKE '%released%'
      AND href = '#/contractor/lead/' || (SELECT id FROM public._t WHERE name = 'rank_job')
  ),
  'leaving the top 3 sends an alert'
);
SELECT public._assert(
  NOT EXISTS (
    SELECT 1 FROM public.token_holds
    WHERE profile_id = '44444444-4444-4444-8444-444444444444'
      AND job_id = (SELECT id FROM public._t WHERE name = 'rank_job')
  ),
  'leaving the top 3 releases the held tokens'
);
SELECT public._assert(
  NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE profile_id = '66666666-6666-4666-8666-666666666666'
      AND title IN ('Your place dropped', 'You dropped out of the top 3')
      AND href = '#/contractor/lead/' || (SELECT id FROM public._t WHERE name = 'rank_job')
  ),
  'the plumber who just bid is not told they dropped'
);

SELECT public._assert(
  NOT has_function_privilege('anon', 'public.place_bid(uuid, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.place_bid(uuid, integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.close_auction(uuid)', 'EXECUTE')
  AND (public.preview_bid((SELECT id FROM public._t WHERE name = 'rank_job'), NULL) ->> 'held') IS NOT NULL,
  'bid preview still reports the held tokens and close stays internal'
);

SELECT 'RETEST CHECKS PASSED' AS result;
