create extension if not exists "pgcrypto";

create table if not exists public.homework_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null,
  due_date date not null,
  completed boolean not null default false,
  completed_date date,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.revision_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  session_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique(user_id, session_date)
);

create table if not exists public.revision_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null,
  duration_minutes integer not null,
  entry_date date not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.brain_dump_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  notes text,
  canvas_data text,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.brain_dump_outlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_notes text not null,
  introduction text not null,
  paragraph_points jsonb not null default '[]'::jsonb,
  conclusion text not null,
  key_points jsonb not null default '[]'::jsonb,
  sentence_starters jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.homework_items enable row level security;
alter table public.revision_sessions enable row level security;
alter table public.revision_log_entries enable row level security;
alter table public.brain_dump_states enable row level security;
alter table public.brain_dump_outlines enable row level security;

create policy "homework_select_own" on public.homework_items
for select using (auth.uid() = user_id);

create policy "homework_insert_own" on public.homework_items
for insert with check (auth.uid() = user_id);

create policy "homework_update_own" on public.homework_items
for update using (auth.uid() = user_id);

create policy "homework_delete_own" on public.homework_items
for delete using (auth.uid() = user_id);

create policy "sessions_select_own" on public.revision_sessions
for select using (auth.uid() = user_id);

create policy "sessions_insert_own" on public.revision_sessions
for insert with check (auth.uid() = user_id);

create policy "sessions_update_own" on public.revision_sessions
for update using (auth.uid() = user_id);

create policy "sessions_delete_own" on public.revision_sessions
for delete using (auth.uid() = user_id);

create policy "revision_log_select_own" on public.revision_log_entries
for select using (auth.uid() = user_id);

create policy "revision_log_insert_own" on public.revision_log_entries
for insert with check (auth.uid() = user_id);

create policy "revision_log_update_own" on public.revision_log_entries
for update using (auth.uid() = user_id);

create policy "revision_log_delete_own" on public.revision_log_entries
for delete using (auth.uid() = user_id);

create policy "brain_dump_select_own" on public.brain_dump_states
for select using (auth.uid() = user_id);

create policy "brain_dump_insert_own" on public.brain_dump_states
for insert with check (auth.uid() = user_id);

create policy "brain_dump_update_own" on public.brain_dump_states
for update using (auth.uid() = user_id);

create policy "brain_dump_delete_own" on public.brain_dump_states
for delete using (auth.uid() = user_id);

create policy "brain_dump_outlines_select_own" on public.brain_dump_outlines
for select using (auth.uid() = user_id);

create policy "brain_dump_outlines_insert_own" on public.brain_dump_outlines
for insert with check (auth.uid() = user_id);

create policy "brain_dump_outlines_update_own" on public.brain_dump_outlines
for update using (auth.uid() = user_id);

create policy "brain_dump_outlines_delete_own" on public.brain_dump_outlines
for delete using (auth.uid() = user_id);
