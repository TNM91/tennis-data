-- A sent player response link must outlive a rebuilt or removed live lineup request.
-- These rows intentionally do not reference the live request so a cascade cannot
-- invalidate a text that has already been delivered.
create table if not exists public.captain_availability_link_snapshots (
  response_token uuid primary key,
  request_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  player_id uuid,
  player_name text not null,
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

create index if not exists captain_availability_link_snapshots_request_idx
  on public.captain_availability_link_snapshots (request_id);

create table if not exists public.captain_availability_link_snapshot_responses (
  id uuid primary key default gen_random_uuid(),
  response_token uuid not null references public.captain_availability_link_snapshots(response_token) on delete cascade,
  player_id uuid,
  player_name text not null,
  match_date date not null,
  status text not null,
  notes text,
  responded_at timestamptz not null default now(),
  constraint captain_availability_link_snapshot_response_status_check
    check (status in ('available', 'maybe', 'unavailable')),
  constraint captain_availability_link_snapshot_response_unique
    unique (response_token, match_date)
);

create index if not exists captain_availability_link_snapshot_responses_token_idx
  on public.captain_availability_link_snapshot_responses (response_token, match_date);

alter table public.captain_availability_link_snapshots enable row level security;
alter table public.captain_availability_link_snapshot_responses enable row level security;
