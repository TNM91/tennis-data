alter table public.team_profile_links
  add column if not exists team_roles text[] not null default array['player']::text[],
  add column if not exists declined_roles text[] not null default array[]::text[],
  add column if not exists role_accepted_at jsonb not null default '{}'::jsonb;

update public.team_profile_links
set team_roles = array[team_role]::text[]
where team_roles is null
   or cardinality(team_roles) = 0
   or not (team_role = any(team_roles));

update public.team_profile_links
set role_accepted_at = jsonb_build_object(
  team_role,
  coalesce(accepted_at, updated_at, created_at)
)
where status = 'accepted'
  and not (role_accepted_at ? team_role);

alter table public.team_profile_links
  drop constraint if exists team_profile_links_team_roles_check,
  drop constraint if exists team_profile_links_declined_roles_check,
  drop constraint if exists team_profile_links_role_accepted_at_check;

alter table public.team_profile_links
  add constraint team_profile_links_team_roles_check
  check (
    cardinality(team_roles) > 0
    and team_roles <@ array['player', 'captain', 'co_captain']::text[]
    and team_role = any(team_roles)
  );

alter table public.team_profile_links
  add constraint team_profile_links_role_accepted_at_check
  check (jsonb_typeof(role_accepted_at) = 'object');

alter table public.team_profile_links
  add constraint team_profile_links_declined_roles_check
  check (
    declined_roles <@ array['player', 'captain', 'co_captain']::text[]
    and not (declined_roles && team_roles)
  );

create index if not exists team_profile_links_team_roles_idx
  on public.team_profile_links using gin (team_roles);
