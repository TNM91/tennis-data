alter table public.tiq_leagues
  add column if not exists weekly_settings jsonb not null default '{
    "enabled": false,
    "collectAvailability": true,
    "autoGenerateCourts": true,
    "collectPlayerStories": true,
    "leagueChatEnabled": false,
    "courtCount": 4,
    "startTimes": ["08:00", "08:30"]
  }'::jsonb;

create table if not exists public.tiq_league_weekly_sessions (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  play_on date not null,
  response_deadline timestamptz null,
  status text not null default 'collecting'
    check (status in ('collecting', 'roster_confirmed', 'published', 'completed')),
  roster jsonb not null default '[]'::jsonb,
  assignments jsonb not null default '[]'::jsonb,
  recap jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, play_on)
);

create table if not exists public.tiq_league_weekly_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tiq_league_weekly_sessions(id) on delete cascade,
  player_name text not null,
  response_status text not null check (response_status in ('in', 'out')),
  note text not null default '',
  positive_share text not null default '',
  responded_at timestamptz not null default now(),
  unique (session_id, player_name)
);

create table if not exists public.tiq_league_weekly_set_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tiq_league_weekly_sessions(id) on delete cascade,
  court_number smallint not null check (court_number between 1 and 24),
  set_number smallint not null check (set_number between 1 and 3),
  side_a_players text[] not null,
  side_b_players text[] not null,
  side_a_games smallint not null check (side_a_games between 0 and 99),
  side_b_games smallint not null check (side_b_games between 0 and 99),
  submitted_by_name text not null default '',
  submitted_at timestamptz not null default now(),
  unique (session_id, court_number, set_number)
);

create table if not exists public.tiq_league_delegates (
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'delegate' check (role in ('owner', 'delegate')),
  created_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists tiq_league_weekly_sessions_date_idx
  on public.tiq_league_weekly_sessions (league_id, play_on desc);
create index if not exists tiq_league_weekly_responses_status_idx
  on public.tiq_league_weekly_responses (session_id, response_status, responded_at);

alter table public.tiq_league_weekly_sessions enable row level security;
alter table public.tiq_league_weekly_responses enable row level security;
alter table public.tiq_league_weekly_set_results enable row level security;
alter table public.tiq_league_delegates enable row level security;

create or replace function public.can_manage_tiq_league(target_league_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tiq_leagues league
    where league.id = target_league_id
      and league.created_by_user_id = auth.uid()
  ) or exists (
    select 1 from public.tiq_league_delegates delegate
    where delegate.league_id = target_league_id
      and delegate.user_id = auth.uid()
  );
$$;

revoke all on function public.can_manage_tiq_league(text) from public;
grant execute on function public.can_manage_tiq_league(text) to authenticated;

create policy "League owners manage weekly sessions"
on public.tiq_league_weekly_sessions for all to authenticated
using (public.can_manage_tiq_league(league_id))
with check (public.can_manage_tiq_league(league_id));

create policy "League owners read weekly responses"
on public.tiq_league_weekly_responses for select to authenticated
using (
  exists (
    select 1 from public.tiq_league_weekly_sessions session
    where session.id = session_id and public.can_manage_tiq_league(session.league_id)
  )
);

create policy "League owners manage weekly results"
on public.tiq_league_weekly_set_results for all to authenticated
using (
  exists (
    select 1 from public.tiq_league_weekly_sessions session
    where session.id = session_id and public.can_manage_tiq_league(session.league_id)
  )
)
with check (
  exists (
    select 1 from public.tiq_league_weekly_sessions session
    where session.id = session_id and public.can_manage_tiq_league(session.league_id)
  )
);

create policy "League owners manage delegates"
on public.tiq_league_delegates for all to authenticated
using (public.can_manage_tiq_league(league_id))
with check (public.can_manage_tiq_league(league_id));

create or replace function public.set_tiq_league_weekly_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tiq_league_weekly_sessions_set_updated_at on public.tiq_league_weekly_sessions;
create trigger tiq_league_weekly_sessions_set_updated_at
before update on public.tiq_league_weekly_sessions
for each row execute function public.set_tiq_league_weekly_updated_at();
