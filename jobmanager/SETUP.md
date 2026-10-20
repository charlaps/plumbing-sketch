# APS Job Manager — what Charl does

The app is already on the website:

https://charlaps.github.io/plumbing-sketch/jobmanager/

It works today with no account and no monthly fee. Each phone keeps its own copy. Supabase is only for when the office phone and the plumbers’ phones must share the same jobs live.

## Use it now (no Supabase)

1. Open the link in Chrome on the phone.
2. The first time, it asks for the owner’s name and a PIN. That PIN stays on this phone.
3. Tap the Chrome menu, then **Add to Home screen**. It then opens like an app and still opens with no signal.
4. Add the office and each plumber under **More → Team**. Each person gets a name, a role, and a PIN.
   - **Owner** is you (admin). You can add people and delete jobs.
   - **Office** can quote, book, and invoice.
   - **Plumber** sees the jobs assigned to them, runs the timer, takes photos, and gets the client’s signature.
5. To put a job on another phone before Supabase is connected: open the job and tap **Send to another phone**. On the other phone, open Job Manager and use **More → Load a backup or job file** (or **Open a job file** on the first screen). Send that file only to your own team. It contains client names and phone numbers.

WhatsApp updates are free links. The plumber taps **WhatsApp: on our way** or **WhatsApp: job done**, then taps Send in WhatsApp. Nothing is sent until they tap Send.

Quotes use the same rates as Quote Finale (already 10% off): R585 an hour, R585 call-out including the first 30 minutes, after-hours R880 an hour, R1,080 after-hours minimum, crew day R4,320, R1,800 a bathroom point, CoC R765. APS is not VAT-registered, so the app never adds VAT and it never prints bank details. The client sees generic names and totals. Materials get a 5% consumables line. The deposit is 80%.

The client’s approval link opens in their browser. They tap approve, then **Tell APS on WhatsApp** so it reaches your phone. You can also tap **Mark approved** on the quote.

Invoices have a box for a Yoco or PayFast link. Paste the https link you created in Yoco or PayFast. The app does not take the money.

## On a computer (office)

Open the same link on a laptop. When you are signed in as owner or office, and the window is wide, you get a side menu: Dashboard, Jobs, Pipeline, Calendar, Clients, Stock, Map, Invoices, Reports, More. A plumber’s phone stays on the simple Jobs, Calendar and More bar. The extra screens are also under More, so the office can open them on a phone.

**Show demo company** (under More) fills the app with sample West Rand jobs, clients, stock and one purchase order so you can click through. **Hide demo company** removes only those sample rows. Hide the demo before **Upload this phone to Supabase** if you do not want the samples in the cloud.

- **Dashboard** shows today’s jobs, money still outstanding, overdue quotes and invoices, low stock, and who is booked today.
- **Pipeline** is the same stages as the phone. Drag a card to another column, or use the stage list on the card.
- **Clients** keeps a person or body corporate, with more than one site, extra contacts, notes, and every job, quote and invoice for them. Search by name, phone or suburb. Saving a job also creates the client and the site if they are new.
- **Stock** counts fittings in the Krugersdorp store and on each van. Transfer between places. On a job card, **Take off stock** reduces the van. A low-stock line appears when the quantity is at or under the reorder number. **Load the Plumblink list into stock** copies the generic names and cost prices onto this phone. It does not place an order. Search and **Add** puts one fitting on the list. Purchase orders default to Plumblink Krugersdorp. **Receive into stock** adds the lines to the store. You can receive an order only once.
- **PDF** on a quote, invoice or job card downloads a branded page: APS logo, generic names, totals, 80% deposit, no VAT, no bank details. **Share PDF** opens the phone share sheet (WhatsApp is in that list on Android). A normal WhatsApp text link cannot carry the file by itself.
- **Map** shows job pins on OpenStreetMap. The map script loads the first time you open Map, so that first open needs a signal. After that the shell is cached; tiles still need a signal. **Check in where I am** stores the plumber’s position on this phone (and on the job, if you check in from the job card). It syncs with the other phones once Supabase is connected.
- **Reports** cover a date range you choose: quoted against won, paid against outstanding, jobs per stage, jobs and hours per person, and materials cost against what you charged. The bars are in the page. **Download CSV** saves the same numbers.

## Connect Supabase when you want every phone on the same list

Cost on the free plan: R0. Do this on a computer. Leave `config.js` empty until the steps below are done. Never paste the `service_role` key into the website. That key bypasses the locks. Only the **anon public** key goes in `config.js`.

1. Go to [https://supabase.com](https://supabase.com) and create a free account.
2. Create a new project. Pick a database password and store it in a password manager. Choose a region in Europe (Ireland or Frankfurt). There is no South Africa region. The free project pauses after about a week with no visits. Open the app once a week, or move to the paid plan later if you need it always on.
3. In the project, open **SQL Editor → New query**. Open `schema.sql` from the `jobmanager` folder, paste the whole file, and run it. If you already ran an older copy, run this file again. It adds the client, site, stock, purchase-order and check-in tables and their locks without wiping jobs you already uploaded. If it says the photo bucket was skipped, open **Storage**, create a private bucket named `job-photos`, then run `schema.sql` again.
4. Open **Authentication → Providers → Email**. You can turn **Confirm email** off for this small team so a new password works without waiting for a message. The built-in mailbox is very limited.
5. Open **Authentication → URL configuration**.
   - Site URL: `https://charlaps.github.io/plumbing-sketch/jobmanager/`
   - Add the same address under Redirect URLs.
6. Open **Authentication → Users → Add user** and create one login each for you, the office, and each plumber. Use an email they can open and a password you tell them.
7. Copy each user’s UUID (it looks like `8b1e…`). In the SQL editor run one line per person, with the real UUID:

```sql
insert into public.profiles (id, name, role, phone)
values ('PASTE-CHARL-UUID', 'Charl Knoetze', 'owner', '072 230 9222');
```

Use role `office` or `plumber` for the others. You must be `owner` or the locks will not let you see the whole list.

8. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
9. Put them in `jobmanager/config.js`:

```js
window.APS_JM = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY'
};
```

10. Save that file to GitHub (the same way this app was published). Reload the site. The sign-in screen becomes email and password. On a phone that already has jobs, open **More → Upload this phone to Supabase** once. Then assign each job to the plumber’s Supabase login. After that, a change on one phone shows on the others when they have a signal. With no signal, the phone keeps working and catches up later. The latest save wins.

What the locks do: the owner and the office see every job, client, stock line and report. A plumber only sees jobs assigned to their login, the clients on those jobs, and the stock on their own van. They can check in and take parts off that van. Purchase orders stay with the office. A client who opens an approval link can see and accept that one quote, and nothing else. The map pins and check-ins follow the same rule: a plumber sees their own position, the office sees the team.
