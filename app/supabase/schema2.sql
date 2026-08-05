-- PASTE 8 — the engine tables: snapshot history, reasons (the WHY),
-- proactive questions, decisions, risk source tags, materiality threshold.
-- Run once in the Supabase SQL editor. Team-only via RLS: none of this is
-- owner-visible except through what the team chooses to publish.

-- Every ingest keeps its full parsed schedule state. The first snapshot of
-- a project is its baseline; nothing here is ever overwritten.
create table if not exists public.programme_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  taken_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'auto')),
  is_baseline boolean not null default false,
  task_count int not null default 0,
  overall int not null default 0,
  tasks jsonb not null
);
create index if not exists programme_snapshots_project_idx
  on programme_snapshots (project_id, taken_at desc);

-- The WHY, permanently attached to the WHAT: one row per answered reason,
-- keyed to the task. Only humans write here.
create table if not exists public.task_reasons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  task_uid text,
  task_name text not null,
  reason text not null,
  change text not null default '',
  author text not null default '',
  at timestamptz not null default now()
);

-- Questions the app asks after an ingest, one per material delta,
-- anchored to the exact task and change.
create table if not exists public.copilot_questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  task_uid text,
  task_name text not null,
  kind text not null default 'slip' check (kind in ('slip', 'pull', 'dep', 'removed')),
  change text not null,
  options jsonb not null default '[]',
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed')),
  created_at timestamptz not null default now()
);

-- Decisions needed from the client/owner — surfaced by the copilot or
-- added by the team; feeds the Report.
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  body text not null,
  task_uid text,
  task_name text,
  status text not null default 'open' check (status in ('open', 'decided')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Risks: where they came from, and (optionally) which task they concern.
-- 'manual' risks are the team's own judgement and are never touched by an
-- import; 'file-derived' ones were raised off a programme delta.
alter table risks add column if not exists source text not null default 'manual'
  check (source in ('manual', 'file-derived'));
alter table risks add column if not exists task_uid text;
alter table risks add column if not exists task_name text;

-- Don't ask about a one-day wobble: per-project materiality threshold.
alter table projects add column if not exists threshold_days int not null default 3;

alter table programme_snapshots enable row level security;
alter table task_reasons enable row level security;
alter table copilot_questions enable row level security;
alter table decisions enable row level security;

create policy "team all snapshots" on programme_snapshots for all using (is_team()) with check (is_team());
create policy "team all reasons"   on task_reasons       for all using (is_team()) with check (is_team());
create policy "team all questions" on copilot_questions  for all using (is_team()) with check (is_team());
create policy "team all decisions" on decisions          for all using (is_team()) with check (is_team());

-- Diary entries can point at a specific look-ahead activity (or stay general).
alter table diary add column if not exists activity text;
