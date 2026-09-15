-- Braidly Database Schema for Supabase
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- =============================================
-- 1. PROFILES (extends Supabase auth.users)
-- =============================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text default '#7aa2f7',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    '#' || lpad(to_hex((random() * 16777215)::int), 6, '0')
  );
  return new;
end;
$$ language plpgsql
   security definer
   set search_path = public, pg_temp;

-- Restrict direct execution (trigger still fires automatically)
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to supabase_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- 2. SESSIONS (project sessions)
-- =============================================
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default 'Untitled Session',
  status text default 'active' check (status in ('active', 'completed', 'archived')),
  member_names text[] default '{}',
  message_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.sessions enable row level security;

create policy "Users can view their own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can create their own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- =============================================
-- 3. MESSAGES (chat messages per session)
-- =============================================
create table if not exists public.messages (
  id text primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  role text not null check (role in ('human', 'ai', 'system')),
  sender text,
  sender_color text,
  text_content text,
  provider text,
  client_id text,
  ts bigint,
  created_at timestamptz default now()
);

create index idx_messages_session_id on public.messages(session_id);

alter table public.messages enable row level security;

create policy "Users can view messages in their sessions"
  on public.messages for select
  using (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

create policy "Users can insert messages in their sessions"
  on public.messages for insert
  with check (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

create policy "Users can update messages in their sessions"
  on public.messages for update
  using (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

create policy "Users can delete messages in their sessions"
  on public.messages for delete
  using (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

-- =============================================
-- 4. BRIEFS (PRD Factory output per session)
-- =============================================
create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade not null,
  module_name text not null,
  owner_name text,
  brief_data jsonb not null default '{}'::jsonb,
  contract_json jsonb default '{}'::jsonb,
  contract_test text,
  created_at timestamptz default now()
);

create index idx_briefs_session_id on public.briefs(session_id);

alter table public.briefs enable row level security;

create policy "Users can manage briefs in their sessions"
  on public.briefs for all
  using (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

-- Shared contract per session
create table if not exists public.shared_contracts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade not null unique,
  contract_data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.shared_contracts enable row level security;

create policy "Users can manage contracts in their sessions"
  on public.shared_contracts for all
  using (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

-- =============================================
-- 5. SUBMISSIONS (code files per module)
-- =============================================
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade not null,
  module_name text not null,
  owner_name text,
  file_path text not null,
  file_content text,
  file_size int default 0,
  submitted_at timestamptz default now(),
  unique(session_id, module_name, file_path)
);

create index idx_submissions_session_id on public.submissions(session_id);

alter table public.submissions enable row level security;

create policy "Users can manage submissions in their sessions"
  on public.submissions for all
  using (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

-- =============================================
-- 6. REPORTS (integration reports per session)
-- =============================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade not null,
  report_data jsonb not null default '{}'::jsonb,
  overall_status text,
  created_at timestamptz default now()
);

create index idx_reports_session_id on public.reports(session_id);

alter table public.reports enable row level security;

create policy "Users can manage reports in their sessions"
  on public.reports for all
  using (
    session_id in (
      select id from public.sessions where user_id = auth.uid()
    )
  );

-- =============================================
-- 7. Enable RLS on profiles
-- =============================================
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- =============================================
-- 8. Enable Realtime for messages (optional, for future use)
-- =============================================
alter publication supabase_realtime add table public.messages;
