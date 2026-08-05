-- PMCC owner portal — complete schema + row-level security.
-- Paste into Supabase: SQL Editor → New query → Run. Idempotent-ish: run once
-- on a fresh project.
--
-- The security model in one sentence: the TEAM sees everything; an OWNER sees
-- only rows tied to their unit or their unit's project, and even then only
-- what has been published. Enforced here, in the database — not in the app.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('team', 'owner')),
  full_name text not null,
  email text unique not null,
  created_at timestamptz not null default now()
);

-- Helper: is the calling user on the PMCC team?
create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'team') $$;

-- ---------------------------------------------------------------- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null default '',
  delivery text not null default '',
  hero_url text,
  overall int not null default 0,
  phases jsonb not null default '[]',      -- [{name, pct}]
  milestones jsonb not null default '[]',  -- [{name, date, done, next}]
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  owner_id uuid references profiles (id),
  name text not null,
  level text not null default '',
  area text not null default '',
  extras text not null default '',
  plan_url text,
  photo_url text,
  price numeric not null default 0,
  member_since text not null default ''
);

-- Which projects can this owner see?
create or replace function public.my_project_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select project_id from units where owner_id = auth.uid() $$;

-- ---------------------------------------------------------------- content
create table public.diary (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  entry_date date not null default current_date,
  phase text not null default '',
  photo_url text,
  body text not null,
  published boolean not null default false,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table public.lookahead (
  project_id uuid primary key references projects (id) on delete cascade,
  updated_at timestamptz not null default now(),
  weeks jsonb not null default '[]'  -- [{label, range, items:[{t,s,note}]}]
);

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'watching' check (status in ('watching', 'open', 'closed')),
  shared_on date not null default current_date
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units (id) on delete cascade,
  name text not null,
  milestone text not null default '',
  amount numeric not null,
  state text not null default 'upcoming' check (state in ('upcoming', 'due', 'paid')),
  paid_on date,
  receipt_url text,
  ord int not null default 0
);

create table public.selections (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units (id) on delete cascade,
  title text not null,
  body text not null default '',
  due date,
  state text not null default 'open' check (state in ('open', 'decided')),
  options jsonb not null default '[]',  -- [{id, name, img}]
  chosen text,
  chosen_name text,
  decided_on date
);

create table public.variations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units (id) on delete cascade,
  title text not null,
  body text not null default '',
  price numeric not null default 0,
  time_impact text not null default 'No programme impact',
  state text not null default 'offered' check (state in ('offered', 'approved', 'declined')),
  approved_on date
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  unit_id uuid references units (id),
  visit_date text not null,
  visit_time text not null,
  state text not null default 'offered' check (state in ('offered', 'booked', 'done')),
  note text not null default ''
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  unit_id uuid references units (id),
  name text not null,
  meta text not null default '',
  url text
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units (id) on delete cascade,
  q text not null,
  a text,
  asked_on date not null default current_date,
  answered_on date
);

-- The parsed contract, per unit — what the chatbot is allowed to quote.
create table public.contract_index (
  unit_id uuid primary key references units (id) on delete cascade,
  clauses jsonb not null default '{}'  -- {signedOn, parties, unitClause, paymentClause, deliveryClause, variationClause, warrantyClause}
);

-- Read receipts: who opened what, when. Quiet legal gold.
create table public.reads (
  profile_id uuid not null references profiles (id) on delete cascade,
  item_kind text not null,
  item_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (profile_id, item_kind, item_id)
);

-- ---------------------------------------------------------------- RLS
alter table profiles enable row level security;
alter table projects enable row level security;
alter table units enable row level security;
alter table diary enable row level security;
alter table lookahead enable row level security;
alter table risks enable row level security;
alter table payments enable row level security;
alter table selections enable row level security;
alter table variations enable row level security;
alter table visits enable row level security;
alter table documents enable row level security;
alter table questions enable row level security;
alter table contract_index enable row level security;
alter table reads enable row level security;

-- profiles: you may read yourself; the team reads everyone.
create policy "own profile" on profiles for select using (id = auth.uid() or is_team());
create policy "team writes profiles" on profiles for all using (is_team()) with check (is_team());

-- team: full access everywhere.
create policy "team all projects"   on projects  for all using (is_team()) with check (is_team());
create policy "team all units"      on units     for all using (is_team()) with check (is_team());
create policy "team all diary"      on diary     for all using (is_team()) with check (is_team());
create policy "team all lookahead"  on lookahead for all using (is_team()) with check (is_team());
create policy "team all risks"      on risks     for all using (is_team()) with check (is_team());
create policy "team all payments"   on payments  for all using (is_team()) with check (is_team());
create policy "team all selections" on selections for all using (is_team()) with check (is_team());
create policy "team all variations" on variations for all using (is_team()) with check (is_team());
create policy "team all visits"     on visits    for all using (is_team()) with check (is_team());
create policy "team all documents"  on documents for all using (is_team()) with check (is_team());
create policy "team all questions"  on questions for all using (is_team()) with check (is_team());
create policy "team all contracts"  on contract_index for all using (is_team()) with check (is_team());
create policy "team reads reads"    on reads for select using (is_team());

-- owners: read what is theirs; published only where publishing exists.
create policy "owner sees own projects" on projects for select
  using (id in (select my_project_ids()));
create policy "owner sees own unit" on units for select
  using (owner_id = auth.uid());
create policy "owner sees published diary" on diary for select
  using (published and project_id in (select my_project_ids()));
create policy "owner sees lookahead" on lookahead for select
  using (project_id in (select my_project_ids()));
create policy "owner sees risks" on risks for select
  using (project_id in (select my_project_ids()));
create policy "owner sees own payments" on payments for select
  using (unit_id in (select id from units where owner_id = auth.uid()));
create policy "owner sees own selections" on selections for select
  using (unit_id in (select id from units where owner_id = auth.uid()));
create policy "owner decides own selections" on selections for update
  using (unit_id in (select id from units where owner_id = auth.uid()));
create policy "owner sees own variations" on variations for select
  using (unit_id in (select id from units where owner_id = auth.uid()));
create policy "owner decides own variations" on variations for update
  using (unit_id in (select id from units where owner_id = auth.uid()));
create policy "owner sees visits" on visits for select
  using (project_id in (select my_project_ids()));
create policy "owner books visits" on visits for update
  using (project_id in (select my_project_ids()));
create policy "owner sees own documents" on documents for select
  using (
    project_id in (select my_project_ids())
    and (unit_id is null or unit_id in (select id from units where owner_id = auth.uid()))
  );
create policy "owner reads own questions" on questions for select
  using (unit_id in (select id from units where owner_id = auth.uid()));
create policy "owner asks questions" on questions for insert
  with check (unit_id in (select id from units where owner_id = auth.uid()));
create policy "owner reads own contract" on contract_index for select
  using (unit_id in (select id from units where owner_id = auth.uid()));
create policy "owner logs reads" on reads for insert with check (profile_id = auth.uid());

-- ---------------------------------------------------------------- storage
-- Run after creating a bucket named "site-photos" (public) and "documents"
-- (private) in Storage. Owners read documents via signed URLs the app asks
-- for; only the team uploads.
