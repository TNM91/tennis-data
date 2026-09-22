create table if not exists public.captain_roster_contacts (
  id uuid primary key default gen_random_uuid(),
  captain_user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  team_name text not null,
  normalized_team_name text not null,
  league_name text not null default '',
  flight text not null default '',
  full_name text not null,
  normalized_name text not null,
  phone text not null default '',
  email text not null default '',
  role text not null default 'Player',
  is_captain boolean not null default false,
  source text not null default 'tennislink_player_roster',
  source_batch_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint captain_roster_contacts_has_contact check (phone <> '' or email <> '')
);

create unique index if not exists captain_roster_contacts_scope_idx
  on public.captain_roster_contacts (
    captain_user_id,
    normalized_team_name,
    normalized_name,
    league_name,
    flight
  );

alter table public.captain_roster_contacts enable row level security;

drop policy if exists "Captains manage their imported roster contacts" on public.captain_roster_contacts;
create policy "Captains manage their imported roster contacts"
on public.captain_roster_contacts
for all
using (captain_user_id = auth.uid())
with check (captain_user_id = auth.uid());

create or replace function public.set_captain_roster_contacts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists captain_roster_contacts_set_updated_at on public.captain_roster_contacts;
create trigger captain_roster_contacts_set_updated_at
before update on public.captain_roster_contacts
for each row
execute function public.set_captain_roster_contacts_updated_at();

alter table if exists public.captain_message_contacts
  add column if not exists email text not null default '';
