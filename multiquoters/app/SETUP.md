# Connect Multiquoters (free)

This folder is the real app. The clickable sample next door (`../`, the demo) stays as it is. Nothing here charges a card. You can run it on the free plans until you outgrow them.

You will need a computer for the one-time setup. After that, you and your contractors use the site on a phone.

The live address, once GitHub Pages has updated, is:

https://charlaps.github.io/plumbing-sketch/multiquoters/app/

The demo stays at:

https://charlaps.github.io/plumbing-sketch/multiquoters/

## Already done

Checked on 11 October 2026. The live project ref is `uihcqmwcngpdyczzkjen`.

- The Supabase project exists. `config.js` has its URL and the public anon key.
- Both original SQL files have been applied: `supabase/migrations/20261011120000_init.sql` and `supabase/migrations/20261011120100_cron.sql`.
- `supabase/migrations/20261011190000_security_fixes.sql` is already applied on the live project. Run it again only if you are setting up a new database.
- `supabase/migrations/20261012180000_launch_fixes.sql` is the new script. Apply it in the SQL editor after the security script (step 2). The website still works before that, but line items, stable bid labels, hiding a non-chosen plumber’s view of the client’s number, the stored consent time, and one review per job need it.
- pg_cron is enabled and `mq_close_auctions` is scheduled every minute.
- Private buckets `job-photos` and `verification` exist. The anon key cannot list them, and an anonymous upload is refused by row level security.
- Authentication Site URL and both redirect URLs point at this app (step 5).
- Calling `public_settings` with the anon key returns 1 token = R20, auctions of 12 hours, 3 winners, VIP at R9,999 a year or R999 a month, and VIP cover of 5 tokens. The home page shows those figures from that call.
- Sign-in and sign-up from the app reach Supabase Auth. Confirm email is on. The built-in inbox is limited to about 2 messages an hour. The connection check did not create an account.

Still open:

- EFT bank details. `config.js` still has the placeholders (`Your business name`, `Your bank`, `0000000000`, `000000`). Wallet, VIP, and Pricing say **Bank details coming soon** and do not print those numbers. Replace the four EFT lines when you have the real account, then commit again.
- An admin login (step 7). Sign-up cannot choose admin.
- Card payments. Still manual EFT only. See `payments.js`.

## 1. Create a free Supabase project

1. Go to [https://supabase.com](https://supabase.com) and create a free account.
2. Create a new project. Pick a database password and store it somewhere safe (a password manager, not this website).
3. Wait until the project status is healthy.

## 2. Run the database scripts

In the Supabase dashboard open **SQL Editor → New query**.

1. Open `supabase/migrations/20261011120000_init.sql` from this folder. Select all, paste it into the query, and run it.
2. Open `supabase/migrations/20261011120100_cron.sql`, paste it, and run it.
3. Open `supabase/migrations/20261011190000_security_fixes.sql`, paste it, and run it.
4. Open `supabase/migrations/20261012180000_launch_fixes.sql`, paste it, and run it. This adds line-item quotes, stable anonymous bid labels, hiding the client’s number from plumbers who were not chosen, a terms-consent time, and one review per job. The website still sends a quote if this step has not been run yet, but line items, stable labels, and the hidden number need this script.
5. Open `supabase/migrations/20261012210000_retest_fixes.sql`, paste it, and run it. This sends an alert when a plumber’s place drops, including when they leave the top 3. It does not change what anyone pays.
6. Open `supabase/migrations/20261013140000_voice_plans_registration.sql`, paste it, and run it last. This adds voice notes, plan files, and the trade registration check. If you re-run the security, launch, or retest script after this, run this file again so a bid still checks the registration. It does not change what anyone pays.

If the second script says pg_cron is not installed, that is expected until the extension is on. Turn the extension on in the next section, then run `20261011120100_cron.sql` again, and then run the security script.

The security script is also the one to run on a database where the first two scripts were applied earlier. It is safe to run once. It stops anonymous calls to internal functions, makes the contractor directory read-only, keeps one accepted quote per job, and gives each contractor a private message thread with the client.

Run that script as the usual SQL editor role, postgres. A notice that default privileges for `supabase_admin` were skipped, or that the event trigger was not installed, is expected. The functions that already exist are still locked.

You can instead use the Supabase CLI (`supabase db query --file ...`) if you install it later. The SQL editor is enough.

Do **not** run `supabase/tests/00_local_auth.sql`, `supabase/tests/01_supabase_grants.sql`, `supabase/tests/02_hosted_postgres.sql`, `supabase/tests/03_apply_security_migration.sql`, `supabase/tests/04_apply_launch_migration.sql`, `supabase/tests/05_apply_retest_migration.sql`, or `supabase/tests/06_apply_features_migration.sql` on Supabase. Those files are only for a Postgres installed on a computer.

To end one job’s auction early, in the SQL editor as postgres (so the normal close runs, including payment of the top 3):

```sql
UPDATE public.job_requests
SET auction_ends_at = now() - interval '1 minute'
WHERE id = 'c1f9a319-beb2-40ff-a85f-a1279e09cb0d'
  AND status = 'open';

SELECT public.close_auction('c1f9a319-beb2-40ff-a85f-a1279e09cb0d');
```

If nobody has bid, that close extends the auction instead, up to twice, which is the same rule as the minute timer. `close_expired_auctions()` closes every expired job, not just this one.

## 3. Turn on the minute timer

Auctions last 12 hours. Something has to close them when the time is up.

1. In the dashboard open **Database → Extensions**.
2. Enable **pg_cron**.
3. Run `20261011120100_cron.sql` again.

It schedules `mq_close_auctions` every minute. The job is safe to run twice: a closed auction is not charged again.

If the extension is not offered on your plan, the site still works, but an auction only closes when the next person tries to bid or when you run this in the SQL editor:

```sql
select public.close_expired_auctions();
```

## 4. Storage for photos and ID documents

The first SQL script creates two **private** buckets when Storage is available:

- `job-photos` — job pictures
- `job-audio` — voice notes, up to 3 per job and 4 MB each
- `job-plans` — drawings and PDFs, up to 5 per job and 10 MB each
- `verification` — ID, trade certificates, and registration cards

If the script printed a notice that storage was skipped, create those two buckets yourself in **Storage**, set them to **private**, and run the first SQL file again (or create the four policies the script describes: owners upload, winners and the client can read job photos, the contractor and admins can read that contractor’s verification files).

The app shrinks each photo to about 200KB before upload so you stay inside the free 1GB.

## 5. Allow this site to sign people in

Open **Authentication → URL configuration**.

- Site URL: `https://charlaps.github.io/plumbing-sketch/multiquoters/app/`
- Redirect URLs, add both:
- `https://charlaps.github.io/plumbing-sketch/multiquoters/app/`
- `https://charlaps.github.io/plumbing-sketch/multiquoters/app/index.html`

Forgot password uses that same Site URL. The reset email opens the app, and the app then shows the new-password screen. You do not need a separate redirect path.

The app uses Supabase’s built-in email (magic link, or email plus password). That inbox is free and **heavily rate-limited** — about 2 messages an hour on this project, and Supabase has at times delivered them only to addresses on your own project team. Check **Authentication → Email** for the current rule. Confirm email is on.

For your own testing, you can turn **Confirm email** off so a password sign-up does not need a message. Turn it back on before real customers join, and expect to add your own free SMTP later if the built-in limit is too low. Magic links use the same limit.

## 6. Paste the public keys

This step is done for the current project. `config.js` already has:

- Project URL `https://uihcqmwcngpdyczzkjen.supabase.co`
- the `anon` `public` key

The four EFT lines are still the placeholders. Real bank details are not available yet. Until you replace them, the site says **Bank details coming soon** and does not show the placeholder account number. When you have the account, put the real name, bank, account number, and branch in `config.js`. Those details are **public** (they appear on the website so contractors can pay). That is normal for EFT.

Leave `EFT_CREDIT_HOURS` at 24, or change the number if you want a different promise.

If the URL or the anon key is emptied again, the site shows **Backend not connected yet** and links to the demo. Commit `config.js` and push it to the `main` branch so GitHub Pages publishes a change.

### Keys you must not paste

The **anon** key is designed to be public. The database rules (row level security) decide what each person can see.

Never put any of these in `config.js` or in git:

- the `service_role` key
- the database password
- a PayFast passphrase

Anyone who has the service role key can bypass the safety rules.

## 7. Make an admin

Sign-up cannot choose admin. Create a **second** email for yourself (keep your contractor login as a contractor, or you will not be able to bid).

1. Sign up on the site with that admin email.
2. In the dashboard open **Authentication → Users** and copy that user’s id.
3. Run this in the SQL editor, with the id pasted in:

```sql
update public.profiles
set role = 'admin'
where id = 'paste-the-user-id';
```

Sign out and sign in again. You should land on the admin screen.

## 8. How money works until card payments exist

There is no card checkout. Paying by card needs a payment provider, and this site does not take one yet.

1. A contractor opens Wallet or VIP and chooses a pack or a plan.
2. The screen says **Pay by EFT — tokens credited within 24 hours** (or whatever you set).
3. The reference is their user code, shaped like `MQ-1A2B3C4D`.
4. When the money arrives in your bank, you open **Admin**, find that code, and press **Credit tokens** or **VIP month / VIP year**.

That is the whole payment loop. The website never adds tokens by itself.

Packs: 10 tokens for R200, 25 for R500, 50 for R1,000. One token is R20.

VIP is R9,999 a year or R999 a month. A VIP bid costs nothing up to 5 tokens on that lead. A bid of 7 charges 2 tokens. VIP cannot buy unlimited bids.

A contractor must be **verified** (ID and trade certificate checked by you) before their bids are accepted.

## 9. Free-tier limits, and when a bill would start

Check the Supabase pricing page when you set this up, because the numbers move. As this app was written, the free project roughly includes:

- about **500MB** for the database
- about **1GB** for files (photos and ID documents)
- the project **pauses after about 7 days** with no activity. The first visit after that can fail or take a minute while it wakes. You restore it from the dashboard. This is the limit most likely to surprise you.
- the built-in auth **email rate limit** (see step 5)
- Realtime for live bids, with a cap on concurrent connections
- pg_cron, once you enable the extension

A monthly cost starts if you need any of these:

- the database to **stay awake** (Supabase Pro, on the order of $25 a month)
- more than the free database, file, or bandwidth allowance
- a large number of auth emails (your own SMTP can still be free; the Supabase plan is what you would pay)

PayFast, if you add it later, has **no monthly fee**. They charge **per successful payment**. Confirm their current fee on payfast.co.za. Do not switch it on until you also have a small Supabase Edge Function to receive the payment notification — GitHub Pages cannot do that safely. The comments in `payments.js` are the slot for that work. Keep the passphrase out of `config.js`.

WhatsApp links (`wa.me`) are free. Tapping one opens the contractor’s or the client’s own WhatsApp. There is no WhatsApp business API bill.

GitHub Pages for this static site is free for a public repository.

## 10. Optional: test the database on your own computer

If you have PostgreSQL installed:

```bash
bash supabase/tests/run.sh
```

That creates a throwaway database, applies the scripts (including `20261011190000_security_fixes.sql` on top of the first two), and checks the auction rules (top 3, releasing tokens, VIP cover, closing twice, and two bids at the same moment). The security script is applied as a non-superuser stand-in for the hosted postgres role, then again after the auction checks. It also checks that the reviewed security holes stay closed. It does not need a Supabase account. The app screens themselves still need the keys from step 6 before they can save anything.
