create table if not exists public.captain_availability_requests (
  id uuid primary key default gen_random_uuid(),
  request_token uuid not null default gen_random_uuid() unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid,
  team_name text not null,
  league_name text not null default '',
  flight text not null default '',
  match_date date not null,
  opponent_team text not null default '',
  match_time text not null default '',
  facility text not null default '',
  slots_json jsonb not null default '[]'::jsonb,
  invited_players_json jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists captain_availability_requests_owner_idx
  on public.captain_availability_requests (created_by, match_date desc);
create table if not exists public.captain_availability_request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.captain_availability_requests(id) on delete cascade,
  player_id uuid,
  player_name text not null,
  match_date date not null,
  status text not null,
  notes text,
  responded_at timestamptz not null default now(),
  constraint captain_availability_response_status_check
    check (status in ('available', 'maybe', 'unavailable')),
  constraint captain_availability_response_unique
    unique (request_id, player_name, match_date)
);
create index if not exists captain_availability_responses_request_idx
  on public.captain_availability_request_responses (request_id, match_date);
alter table public.captain_availability_requests enable row level security;
alter table public.captain_availability_request_responses enable row level security;
drop policy if exists captain_availability_requests_owner_select on public.captain_availability_requests;
create policy captain_availability_requests_owner_select
  on public.captain_availability_requests
  for select
  to authenticated
  using (created_by = auth.uid());
drop policy if exists captain_availability_requests_owner_insert on public.captain_availability_requests;
create policy captain_availability_requests_owner_insert
  on public.captain_availability_requests
  for insert
  to authenticated
  with check (created_by = auth.uid());
drop policy if exists captain_availability_requests_owner_update on public.captain_availability_requests;
create policy captain_availability_requests_owner_update
  on public.captain_availability_requests
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
