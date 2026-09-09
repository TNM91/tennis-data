create table if not exists public.captain_practice_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.internal_schedule_events(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  capacity smallint null check (capacity is null or capacity between 1 and 100),
  created_by_user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.captain_practice_invitees (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.captain_practice_invites(id) on delete cascade,
  event_id uuid not null references public.internal_schedule_events(id) on delete cascade,
  player_id text not null default '',
  profile_id uuid null references public.profiles(id) on delete set null,
  player_name text not null,
  normalized_name text not null,
  phone text not null default '',
  response_status text not null default 'unanswered'
    check (response_status in ('in', 'out', 'maybe', 'unanswered')),
  note text not null default '',
  responded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists captain_practice_invitees_name_idx
  on public.captain_practice_invitees (invite_id, normalized_name);

create index if not exists captain_practice_invitees_status_idx
  on public.captain_practice_invitees (invite_id, response_status, responded_at);

create index if not exists captain_practice_invitees_profile_event_idx
  on public.captain_practice_invitees (profile_id, event_id);

alter table public.captain_practice_invites enable row level security;
alter table public.captain_practice_invitees enable row level security;

drop policy if exists "Captains manage their practice invites" on public.captain_practice_invites;
create policy "Captains manage their practice invites"
on public.captain_practice_invites
for all to authenticated
using (created_by_user_id = auth.uid())
with check (created_by_user_id = auth.uid());

drop policy if exists "Captains manage their practice invitees" on public.captain_practice_invitees;
create policy "Captains manage their practice invitees"
on public.captain_practice_invitees
for all to authenticated
using (
  exists (
    select 1 from public.captain_practice_invites invite
    where invite.id = captain_practice_invitees.invite_id
      and invite.created_by_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.captain_practice_invites invite
    where invite.id = captain_practice_invitees.invite_id
      and invite.created_by_user_id = auth.uid()
  )
);

drop policy if exists "Players update their own practice RSVP" on public.captain_practice_invitees;
create policy "Players update their own practice RSVP"
on public.captain_practice_invitees
for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "Players read their own practice RSVP" on public.captain_practice_invitees;
create policy "Players read their own practice RSVP"
on public.captain_practice_invitees
for select to authenticated
using (profile_id = auth.uid());

create or replace function public.set_captain_practice_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists captain_practice_invites_set_updated_at on public.captain_practice_invites;
create trigger captain_practice_invites_set_updated_at
before update on public.captain_practice_invites
for each row execute function public.set_captain_practice_updated_at();

drop trigger if exists captain_practice_invitees_set_updated_at on public.captain_practice_invitees;
create trigger captain_practice_invitees_set_updated_at
before update on public.captain_practice_invitees
for each row execute function public.set_captain_practice_updated_at();
