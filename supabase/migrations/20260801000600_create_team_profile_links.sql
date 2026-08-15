create table if not exists public.team_profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references public.profiles(id) on delete cascade,
  source_actor_user_id uuid null references auth.users(id) on delete set null,
  team_name text not null,
  normalized_team_name text not null,
  league_name text not null default '',
  flight text not null default '',
  team_role text not null default 'player'
    check (team_role in ('player', 'captain', 'co_captain')),
  matched_player_id uuid null references public.players(id) on delete set null,
  source_type text not null
    check (source_type in ('roster_contact', 'roster_membership', 'tiq_entry', 'manual_invite')),
  source_record_id uuid null,
  status text not null default 'accepted'
    check (status in ('accepted', 'declined', 'unlinked')),
  accepted_at timestamptz null,
  unlinked_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists team_profile_links_profile_scope_idx
  on public.team_profile_links (
    profile_user_id,
    normalized_team_name,
    league_name,
    flight
  );
create index if not exists team_profile_links_profile_status_idx
  on public.team_profile_links (profile_user_id, status, updated_at desc);
create index if not exists team_profile_links_source_actor_idx
  on public.team_profile_links (source_actor_user_id, updated_at desc)
  where source_actor_user_id is not null;
create or replace function public.set_team_profile_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;
drop trigger if exists team_profile_links_set_updated_at on public.team_profile_links;
create trigger team_profile_links_set_updated_at
before update on public.team_profile_links
for each row
execute function public.set_team_profile_links_updated_at();
alter table public.team_profile_links enable row level security;
drop policy if exists "Members can read own team profile links" on public.team_profile_links;
create policy "Members can read own team profile links"
  on public.team_profile_links for select to authenticated
  using (profile_user_id = auth.uid());
drop policy if exists "Members can create own team profile links" on public.team_profile_links;
create policy "Members can create own team profile links"
  on public.team_profile_links for insert to authenticated
  with check (profile_user_id = auth.uid());
drop policy if exists "Members can update own team profile links" on public.team_profile_links;
create policy "Members can update own team profile links"
  on public.team_profile_links for update to authenticated
  using (profile_user_id = auth.uid())
  with check (profile_user_id = auth.uid());
