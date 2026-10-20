-- APS Job Manager — Supabase schema
-- Run this once in the Supabase SQL editor (as postgres) on a new free project.
-- It is safe to run again. It does not hold client money and it does not add VAT.
--
-- Row level security:
--   owner and office see the whole business
--   a plumber sees and updates only jobs assigned to their login
--   a client approval link can read and accept one quote, and nothing else

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role text not null default 'plumber' check (role in ('owner', 'office', 'plumber')),
  phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key,
  no text not null unique,
  status text not null default 'lead' check (status in ('lead', 'quoted', 'booked', 'progress', 'done', 'invoiced', 'paid')),
  client_name text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  suburb text not null default '',
  title text not null default '',
  scope text not null default '',
  notes text not null default '',
  assigned_to uuid,
  start_at timestamptz,
  end_at timestamptz,
  quote_id uuid,
  invoice_id uuid,
  wa_log jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key,
  no text not null unique,
  job_id uuid,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'declined')),
  approval_token text,
  approved_at timestamptz,
  declined_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  body jsonb not null default '{}'::jsonb
);

create table if not exists public.invoices (
  id uuid primary key,
  no text not null unique,
  job_id uuid,
  quote_id uuid,
  status text not null default 'draft' check (status in ('draft', 'sent', 'partial', 'paid')),
  pay_link text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  body jsonb not null default '{}'::jsonb
);

create table if not exists public.job_cards (
  job_id uuid primary key,
  notes text not null default '',
  signature text not null default '',
  signed_name text not null default '',
  signed_at timestamptz,
  timer jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key,
  job_id uuid not null,
  storage_path text,
  caption text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists jobs_assigned_idx on public.jobs (assigned_to);
create index if not exists jobs_start_idx on public.jobs (start_at);
create index if not exists jobs_updated_idx on public.jobs (updated_at);
create index if not exists quotes_job_idx on public.quotes (job_id);
create index if not exists quotes_updated_idx on public.quotes (updated_at);
create unique index if not exists quotes_token_uidx on public.quotes (approval_token) where approval_token is not null;
create index if not exists invoices_job_idx on public.invoices (job_id);
create index if not exists photos_job_idx on public.photos (job_id);

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() in ('owner', 'office')
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() = 'owner'
$$;

create or replace function public.guard_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_owner() then
    return new;
  end if;
  if new.role is distinct from old.role or new.active is distinct from old.active then
    raise exception 'Only the owner can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile();

-- Client link: returns the public quote only (no costs, no other jobs).
create or replace function public.quote_for_token(tok text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare rec public.quotes;
begin
  if tok is null or length(tok) < 12 then
    return null;
  end if;
  select * into rec from public.quotes where approval_token = tok;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'no', rec.no,
    'status', rec.status,
    'public', rec.body -> 'public',
    'approved_at', rec.approved_at,
    'declined_at', rec.declined_at
  );
end;
$$;

-- Client link: approve or decline that one quote.
create or replace function public.decide_quote(tok text, decision text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare rec public.quotes;
begin
  if tok is null or length(tok) < 12 then
    return jsonb_build_object('ok', false, 'error', 'missing');
  end if;
  if decision not in ('approved', 'declined') then
    return jsonb_build_object('ok', false, 'error', 'bad decision');
  end if;
  select * into rec from public.quotes where approval_token = tok;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not found');
  end if;
  if rec.status in ('approved', 'declined') then
    return jsonb_build_object('ok', true, 'status', rec.status, 'no', rec.no, 'already', true);
  end if;
  if decision = 'approved' then
    update public.quotes
      set status = 'approved', approved_at = now(), updated_at = now()
      where id = rec.id;
  else
    update public.quotes
      set status = 'declined', declined_at = now(), updated_at = now()
      where id = rec.id;
  end if;
  return jsonb_build_object('ok', true, 'status', decision, 'no', rec.no);
end;
$$;

revoke all on function public.my_role() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_owner() from public, anon;
revoke all on function public.guard_profile() from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_owner() to authenticated;

revoke all on function public.quote_for_token(text) from public;
revoke all on function public.decide_quote(text, text) from public;
grant execute on function public.quote_for_token(text) to anon, authenticated;
grant execute on function public.decide_quote(text, text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.quotes enable row level security;
alter table public.invoices enable row level security;
alter table public.job_cards enable row level security;
alter table public.photos enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_owner())
  with check (id = auth.uid() or public.is_owner());

drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select to authenticated
  using (public.is_staff() or assigned_to = auth.uid());

drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs
  for update to authenticated
  using (public.is_staff() or assigned_to = auth.uid())
  with check (public.is_staff() or assigned_to = auth.uid());

drop policy if exists jobs_delete on public.jobs;
create policy jobs_delete on public.jobs
  for delete to authenticated
  using (public.is_staff());

drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes
  for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.jobs j where j.id = quotes.job_id and j.assigned_to = auth.uid())
  );

drop policy if exists quotes_write on public.quotes;
create policy quotes_write on public.quotes
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists invoices_staff on public.invoices;
create policy invoices_staff on public.invoices
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists cards_select on public.job_cards;
create policy cards_select on public.job_cards
  for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.jobs j where j.id = job_cards.job_id and j.assigned_to = auth.uid())
  );

drop policy if exists cards_write on public.job_cards;
create policy cards_write on public.job_cards
  for insert to authenticated
  with check (
    public.is_staff()
    or exists (select 1 from public.jobs j where j.id = job_cards.job_id and j.assigned_to = auth.uid())
  );

drop policy if exists cards_update on public.job_cards;
create policy cards_update on public.job_cards
  for update to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.jobs j where j.id = job_cards.job_id and j.assigned_to = auth.uid())
  )
  with check (
    public.is_staff()
    or exists (select 1 from public.jobs j where j.id = job_cards.job_id and j.assigned_to = auth.uid())
  );

drop policy if exists cards_delete on public.job_cards;
create policy cards_delete on public.job_cards
  for delete to authenticated
  using (public.is_staff());

drop policy if exists photos_select on public.photos;
create policy photos_select on public.photos
  for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.jobs j where j.id = photos.job_id and j.assigned_to = auth.uid())
  );

drop policy if exists photos_insert on public.photos;
create policy photos_insert on public.photos
  for insert to authenticated
  with check (
    public.is_staff()
    or exists (select 1 from public.jobs j where j.id = photos.job_id and j.assigned_to = auth.uid())
  );

drop policy if exists photos_delete on public.photos;
create policy photos_delete on public.photos
  for delete to authenticated
  using (public.is_staff());

alter table public.jobs add column if not exists client_id uuid;
alter table public.jobs add column if not exists site_id uuid;
alter table public.jobs add column if not exists lat double precision;
alter table public.jobs add column if not exists lng double precision;

create table if not exists public.clients (
  id uuid primary key,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key,
  client_id uuid,
  label text not null default '',
  address text not null default '',
  suburb text not null default '',
  lat double precision,
  lng double precision,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key,
  client_id uuid,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  role text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key,
  name text not null default '',
  kind text not null default 'warehouse' check (kind in ('warehouse', 'van')),
  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_items (
  id uuid primary key,
  code text not null default '',
  name text not null default '',
  generic text not null default '',
  unit text not null default 'each',
  cost numeric not null default 0,
  reorder numeric not null default 0,
  supplier text not null default '',
  cls text not null default 'f',
  description text not null default '',
  material text not null default '',
  joint text not null default '',
  ftype text not null default '',
  size text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stock_items add column if not exists description text not null default '';
alter table public.stock_items add column if not exists material text not null default '';
alter table public.stock_items add column if not exists joint text not null default '';
alter table public.stock_items add column if not exists ftype text not null default '';
alter table public.stock_items add column if not exists size text not null default '';

create table if not exists public.stock_levels (
  id uuid primary key,
  item_id uuid,
  place_id uuid,
  qty numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_moves (
  id uuid primary key,
  item_id uuid,
  place_id uuid,
  qty numeric not null default 0,
  job_id uuid,
  kind text not null default 'adjust',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key,
  no text not null,
  supplier text not null default '',
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received')),
  place_id uuid,
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id uuid primary key,
  user_id uuid,
  job_id uuid,
  lat double precision,
  lng double precision,
  accuracy double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sites_client_idx on public.sites (client_id);
create index if not exists contacts_client_idx on public.contacts (client_id);
create index if not exists stock_levels_place_idx on public.stock_levels (place_id);
create index if not exists stock_moves_job_idx on public.stock_moves (job_id);
create index if not exists checkins_user_idx on public.checkins (user_id);
create index if not exists jobs_client_idx on public.jobs (client_id);

create or replace function public.my_van(place uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.places p
    where p.id = place and p.kind = 'van' and p.user_id = auth.uid()
  )
$$;

revoke all on function public.my_van(uuid) from public, anon;
grant execute on function public.my_van(uuid) to authenticated;

alter table public.clients enable row level security;
alter table public.sites enable row level security;
alter table public.contacts enable row level security;
alter table public.places enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_moves enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.checkins enable row level security;

drop policy if exists clients_staff on public.clients;
create policy clients_staff on public.clients for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists clients_plumber on public.clients;
create policy clients_plumber on public.clients for select to authenticated
  using (exists (select 1 from public.jobs j where j.client_id = clients.id and j.assigned_to = auth.uid()));

drop policy if exists sites_staff on public.sites;
create policy sites_staff on public.sites for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists sites_plumber on public.sites;
create policy sites_plumber on public.sites for select to authenticated
  using (exists (select 1 from public.jobs j where j.site_id = sites.id and j.assigned_to = auth.uid()));

drop policy if exists contacts_staff on public.contacts;
create policy contacts_staff on public.contacts for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists contacts_plumber on public.contacts;
create policy contacts_plumber on public.contacts for select to authenticated
  using (exists (select 1 from public.jobs j where j.client_id = contacts.client_id and j.assigned_to = auth.uid()));

drop policy if exists places_staff on public.places;
create policy places_staff on public.places for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists places_read on public.places;
create policy places_read on public.places for select to authenticated using (true);

drop policy if exists stock_items_staff on public.stock_items;
create policy stock_items_staff on public.stock_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists stock_items_read on public.stock_items;
create policy stock_items_read on public.stock_items for select to authenticated using (true);

drop policy if exists levels_staff on public.stock_levels;
create policy levels_staff on public.stock_levels for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists levels_read on public.stock_levels;
create policy levels_read on public.stock_levels for select to authenticated using (true);
drop policy if exists levels_van on public.stock_levels;
create policy levels_van on public.stock_levels for update to authenticated
  using (public.my_van(place_id)) with check (public.my_van(place_id));
drop policy if exists levels_van_ins on public.stock_levels;
create policy levels_van_ins on public.stock_levels for insert to authenticated
  with check (public.my_van(place_id));

drop policy if exists moves_staff on public.stock_moves;
create policy moves_staff on public.stock_moves for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists moves_read on public.stock_moves;
create policy moves_read on public.stock_moves for select to authenticated
  using (public.my_van(place_id) or exists (select 1 from public.jobs j where j.id = stock_moves.job_id and j.assigned_to = auth.uid()));
drop policy if exists moves_van on public.stock_moves;
create policy moves_van on public.stock_moves for insert to authenticated
  with check (public.my_van(place_id));

drop policy if exists po_staff on public.purchase_orders;
create policy po_staff on public.purchase_orders for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists checkins_read on public.checkins;
create policy checkins_read on public.checkins for select to authenticated
  using (public.is_staff() or user_id = auth.uid());
drop policy if exists checkins_write on public.checkins;
create policy checkins_write on public.checkins for insert to authenticated
  with check (user_id = auth.uid() or public.is_staff());

revoke all on public.profiles, public.jobs, public.quotes, public.invoices, public.job_cards, public.photos,
  public.clients, public.sites, public.contacts, public.places, public.stock_items, public.stock_levels,
  public.stock_moves, public.purchase_orders, public.checkins from anon;
grant select, insert, update, delete on public.profiles, public.jobs, public.quotes, public.invoices, public.job_cards, public.photos,
  public.clients, public.sites, public.contacts, public.places, public.stock_items, public.stock_levels,
  public.stock_moves, public.purchase_orders, public.checkins to authenticated;

-- Private photo bucket. Skip quietly if Storage is not available yet.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit)
  values ('job-photos', 'job-photos', false, 5242880)
  on conflict (id) do nothing;
exception when others then
  raise notice 'Storage bucket was not created (%). Create a private bucket named job-photos, then run this file again.', sqlerrm;
end $$;

do $$
begin
  execute 'drop policy if exists job_photos_read on storage.objects';
  execute 'create policy job_photos_read on storage.objects for select to authenticated using (
    bucket_id = ''job-photos'' and (
      public.is_staff()
      or (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.photos p
        join public.jobs j on j.id = p.job_id
        where p.storage_path = storage.objects.name and j.assigned_to = auth.uid()
      )
    )
  )';
  execute 'drop policy if exists job_photos_insert on storage.objects';
  execute 'create policy job_photos_insert on storage.objects for insert to authenticated with check (
    bucket_id = ''job-photos''
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      public.is_staff()
      or exists (
        select 1 from public.jobs j
        where j.id::text = (storage.foldername(name))[2] and j.assigned_to = auth.uid()
      )
    )
  )';
  execute 'drop policy if exists job_photos_update on storage.objects';
  execute 'create policy job_photos_update on storage.objects for update to authenticated using (
    bucket_id = ''job-photos'' and (storage.foldername(name))[1] = auth.uid()::text
  )';
exception when others then
  raise notice 'Photo policies were not created (%). Create the job-photos bucket, then run this file again.', sqlerrm;
end $$;
