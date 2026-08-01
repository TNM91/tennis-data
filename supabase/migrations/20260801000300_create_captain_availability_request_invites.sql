create table if not exists public.captain_availability_request_invites (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.captain_availability_requests(id) on delete cascade,
  response_token uuid not null default gen_random_uuid() unique,
  player_id uuid,
  player_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint captain_availability_invite_unique
    unique (request_id, player_name)
);

create index if not exists captain_availability_invites_request_idx
  on public.captain_availability_request_invites (request_id);

alter table public.captain_availability_request_invites enable row level security;
