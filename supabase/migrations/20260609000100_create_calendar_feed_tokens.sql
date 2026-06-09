create table if not exists public.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  scope_type text not null,
  scope_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  viewer_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint calendar_feed_tokens_scope_type_check check (scope_type in ('coach_student')),
  constraint calendar_feed_tokens_status_check check (status in ('active', 'revoked'))
);

alter table public.calendar_feed_tokens enable row level security;

drop policy if exists "Calendar token owners can read their feeds" on public.calendar_feed_tokens;
drop policy if exists "Calendar token owners can create feeds" on public.calendar_feed_tokens;
drop policy if exists "Calendar token owners can update feeds" on public.calendar_feed_tokens;

create policy "Calendar token owners can read their feeds"
  on public.calendar_feed_tokens
  for select
  using (auth.uid() = owner_user_id or auth.uid() = viewer_user_id);

create policy "Calendar token owners can create feeds"
  on public.calendar_feed_tokens
  for insert
  with check (auth.uid() = owner_user_id);

create policy "Calendar token owners can update feeds"
  on public.calendar_feed_tokens
  for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create index if not exists calendar_feed_tokens_scope_idx
  on public.calendar_feed_tokens (scope_type, scope_id, status);

create index if not exists calendar_feed_tokens_owner_idx
  on public.calendar_feed_tokens (owner_user_id, created_at desc);
