-- Separate from personal/coach feeds: sharing never grants whole-calendar access.
create table public.match_calendar_shares (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text not null check (length(label) between 1 and 80),
  team_name text not null check (length(team_name) between 1 and 200),
  season_key text not null check (length(season_key) between 1 and 1000),
  time_zone text not null default 'America/Chicago' check (time_zone in ('America/New_York','America/Chicago','America/Denver','America/Phoenix','America/Los_Angeles','America/Anchorage','Pacific/Honolulu')),
  item_ids text[] not null check (cardinality(item_ids) between 1 and 500),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.match_calendar_shares enable row level security;
revoke all on public.match_calendar_shares from public, anon, authenticated;
grant select, insert, update on public.match_calendar_shares to authenticated;
grant all on public.match_calendar_shares to service_role;
create policy "Owners read match calendar shares" on public.match_calendar_shares for select to authenticated using (auth.uid()=owner_user_id);
create policy "Owners create match calendar shares" on public.match_calendar_shares for insert to authenticated with check (auth.uid()=owner_user_id);
create policy "Owners update match calendar shares" on public.match_calendar_shares for update to authenticated using (auth.uid()=owner_user_id) with check (auth.uid()=owner_user_id);
create index match_calendar_shares_owner_idx on public.match_calendar_shares(owner_user_id,status,created_at desc);
