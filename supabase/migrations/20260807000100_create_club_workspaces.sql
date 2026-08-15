create extension if not exists pgcrypto;
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text not null default '',
  logo_url text not null default '',
  hero_image_url text not null default '',
  primary_color text not null default '#9dea16',
  location_label text not null default '',
  contact_email text not null default '',
  time_zone text not null default 'America/Chicago',
  is_public boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clubs_name_check check (char_length(btrim(name)) between 2 and 120),
  constraint clubs_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint clubs_primary_color_check check (primary_color ~ '^#[0-9a-fA-F]{6}$')
);
create table if not exists public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  roles text[] not null default array['player']::text[],
  status text not null default 'active',
  display_name text not null default '',
  email text not null default '',
  phone text not null default '',
  joined_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_memberships_status_check check (status in ('active', 'inactive', 'removed')),
  constraint club_memberships_roles_check check (
    cardinality(roles) > 0
    and roles <@ array['owner', 'admin', 'director', 'coach', 'captain', 'coordinator', 'player', 'guardian']::text[]
  )
);
create unique index if not exists club_memberships_user_idx
  on public.club_memberships (club_id, user_id)
  where user_id is not null and status <> 'removed';
create index if not exists club_memberships_club_status_idx
  on public.club_memberships (club_id, status, updated_at desc);
create table if not exists public.club_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  roles text[] not null default array['player']::text[],
  invite_token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending',
  expires_at timestamptz not null default (timezone('utc', now()) + interval '30 days'),
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_invites_email_check check (position('@' in email) > 1),
  constraint club_invites_status_check check (status in ('pending', 'accepted', 'revoked', 'expired')),
  constraint club_invites_roles_check check (
    cardinality(roles) > 0
    and roles <@ array['admin', 'director', 'coach', 'captain', 'coordinator', 'player', 'guardian']::text[]
  )
);
create index if not exists club_invites_club_status_idx
  on public.club_invites (club_id, status, created_at desc);
create index if not exists club_invites_email_idx
  on public.club_invites (lower(email), status);
create table if not exists public.club_groups (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  group_type text not null default 'clinic',
  description text not null default '',
  season_label text not null default '',
  lead_user_id uuid references auth.users(id) on delete set null,
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_groups_name_check check (char_length(btrim(name)) between 2 and 120),
  constraint club_groups_type_check check (group_type in ('clinic', 'team', 'camp', 'development_group', 'league_division', 'tournament_field'))
);
create index if not exists club_groups_club_active_idx
  on public.club_groups (club_id, is_active, updated_at desc);
create table if not exists public.club_group_members (
  group_id uuid not null references public.club_groups(id) on delete cascade,
  membership_id uuid not null references public.club_memberships(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (group_id, membership_id),
  constraint club_group_members_status_check check (status in ('active', 'waitlist', 'inactive'))
);
create table if not exists public.club_competition_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  competition_type text not null,
  entrant_type text not null default 'players',
  format_id text not null default 'round_robin',
  division_label text not null default '',
  default_facility text not null default '',
  schedule_notes text not null default '',
  rules_json jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_competition_templates_name_check check (char_length(btrim(name)) between 2 and 120),
  constraint club_competition_templates_type_check check (competition_type in ('league', 'tournament')),
  constraint club_competition_templates_entrant_check check (entrant_type in ('players', 'teams'))
);
create index if not exists club_competition_templates_club_idx
  on public.club_competition_templates (club_id, competition_type, updated_at desc);
alter table public.tiq_leagues
  add column if not exists club_id uuid references public.clubs(id) on delete set null;
alter table public.tiq_tournaments
  add column if not exists club_id uuid references public.clubs(id) on delete set null;
create index if not exists tiq_leagues_club_idx on public.tiq_leagues (club_id, updated_at desc);
create index if not exists tiq_tournaments_club_idx on public.tiq_tournaments (club_id, updated_at desc);
create or replace function public.is_club_member(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_memberships membership
    where membership.club_id = target_club_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;
create or replace function public.can_manage_club(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clubs club
    where club.id = target_club_id
      and club.owner_user_id = auth.uid()
  ) or exists (
    select 1
    from public.club_memberships membership
    where membership.club_id = target_club_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.roles && array['owner', 'admin', 'director']::text[]
  );
$$;
create or replace function public.can_run_club_competition(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_club(target_club_id) or exists (
    select 1
    from public.club_memberships membership
    where membership.club_id = target_club_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.roles && array['coach', 'captain', 'coordinator']::text[]
  );
$$;
create or replace function public.add_club_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.club_memberships (
    club_id,
    user_id,
    roles,
    status,
    display_name,
    email,
    joined_at
  )
  values (
    new.id,
    new.owner_user_id,
    array['owner']::text[],
    'active',
    coalesce((select nullif(btrim(linked_player_name), '') from public.profiles where id = new.owner_user_id), ''),
    coalesce((select email from auth.users where id = new.owner_user_id), ''),
    timezone('utc', now())
  )
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists add_club_owner_membership on public.clubs;
create trigger add_club_owner_membership
after insert on public.clubs
for each row execute function public.add_club_owner_membership();
create or replace function public.set_club_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;
drop trigger if exists set_clubs_updated_at on public.clubs;
create trigger set_clubs_updated_at before update on public.clubs
for each row execute function public.set_club_updated_at();
drop trigger if exists set_club_memberships_updated_at on public.club_memberships;
create trigger set_club_memberships_updated_at before update on public.club_memberships
for each row execute function public.set_club_updated_at();
drop trigger if exists set_club_invites_updated_at on public.club_invites;
create trigger set_club_invites_updated_at before update on public.club_invites
for each row execute function public.set_club_updated_at();
drop trigger if exists set_club_groups_updated_at on public.club_groups;
create trigger set_club_groups_updated_at before update on public.club_groups
for each row execute function public.set_club_updated_at();
drop trigger if exists set_club_competition_templates_updated_at on public.club_competition_templates;
create trigger set_club_competition_templates_updated_at before update on public.club_competition_templates
for each row execute function public.set_club_updated_at();
create or replace function public.get_club_invite_preview(target_invite_token uuid)
returns table (
  club_name text,
  club_slug text,
  club_logo_url text,
  invite_email text,
  invite_roles text[],
  invite_status text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    club.name,
    club.slug,
    club.logo_url,
    invite.email,
    invite.roles,
    case
      when invite.status = 'pending' and invite.expires_at <= timezone('utc', now()) then 'expired'
      else invite.status
    end,
    invite.expires_at
  from public.club_invites invite
  join public.clubs club on club.id = invite.club_id
  where invite.invite_token = target_invite_token
  limit 1;
$$;
create or replace function public.accept_club_invite(target_invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_record public.club_invites%rowtype;
  signed_in_email text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept this club invitation.';
  end if;

  signed_in_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select * into invite_record
  from public.club_invites
  where invite_token = target_invite_token
  for update;

  if invite_record.id is null then
    raise exception 'Club invitation not found.';
  end if;
  if invite_record.status <> 'pending' or invite_record.expires_at <= timezone('utc', now()) then
    raise exception 'This club invitation is no longer active.';
  end if;
  if signed_in_email = '' or signed_in_email <> lower(invite_record.email) then
    raise exception 'Sign in with the email address that received this invitation.';
  end if;

  insert into public.club_memberships (
    club_id,
    user_id,
    roles,
    status,
    display_name,
    email,
    joined_at
  )
  values (
    invite_record.club_id,
    auth.uid(),
    invite_record.roles,
    'active',
    coalesce((select nullif(btrim(linked_player_name), '') from public.profiles where id = auth.uid()), ''),
    invite_record.email,
    timezone('utc', now())
  )
  on conflict (club_id, user_id) where user_id is not null and status <> 'removed'
  do update set
    roles = (
      select array_agg(distinct role_name)
      from unnest(public.club_memberships.roles || excluded.roles) role_name
    ),
    status = 'active',
    joined_at = coalesce(public.club_memberships.joined_at, timezone('utc', now()));

  update public.club_invites
  set
    status = 'accepted',
    accepted_by_user_id = auth.uid(),
    accepted_at = timezone('utc', now())
  where id = invite_record.id;

  return invite_record.club_id;
end;
$$;
alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.club_invites enable row level security;
alter table public.club_groups enable row level security;
alter table public.club_group_members enable row level security;
alter table public.club_competition_templates enable row level security;
create policy "Public and members can read clubs" on public.clubs
for select using (is_public or public.is_club_member(id));
create policy "Members can create clubs" on public.clubs
for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Club managers can update clubs" on public.clubs
for update to authenticated using (public.can_manage_club(id)) with check (public.can_manage_club(id));
create policy "Club owners can delete clubs" on public.clubs
for delete to authenticated using (owner_user_id = auth.uid());
create policy "Club members can read memberships" on public.club_memberships
for select to authenticated using (public.is_club_member(club_id));
create policy "Club managers can add memberships" on public.club_memberships
for insert to authenticated with check (public.can_manage_club(club_id));
create policy "Club managers can update memberships" on public.club_memberships
for update to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
create policy "Club managers can remove memberships" on public.club_memberships
for delete to authenticated using (public.can_manage_club(club_id));
create policy "Club managers and invited users can read invites" on public.club_invites
for select to authenticated using (
  public.can_manage_club(club_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
create policy "Club managers can create invites" on public.club_invites
for insert to authenticated with check (
  public.can_manage_club(club_id)
  and invited_by_user_id = auth.uid()
);
create policy "Club managers can update invites" on public.club_invites
for update to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
create policy "Club managers can delete invites" on public.club_invites
for delete to authenticated using (public.can_manage_club(club_id));
create policy "Public and members can read club groups" on public.club_groups
for select using (
  public.is_club_member(club_id)
  or (
    is_public
    and exists (select 1 from public.clubs club where club.id = club_id and club.is_public)
  )
);
create policy "Club staff can create groups" on public.club_groups
for insert to authenticated with check (
  public.can_run_club_competition(club_id)
  and created_by_user_id = auth.uid()
);
create policy "Club staff can update groups" on public.club_groups
for update to authenticated using (
  public.can_manage_club(club_id) or lead_user_id = auth.uid()
) with check (
  public.can_manage_club(club_id) or lead_user_id = auth.uid()
);
create policy "Club managers can delete groups" on public.club_groups
for delete to authenticated using (public.can_manage_club(club_id));
create policy "Club members can read group rosters" on public.club_group_members
for select to authenticated using (
  exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id and public.is_club_member(club_group.club_id)
  )
);
create policy "Club staff can manage group rosters" on public.club_group_members
for all to authenticated using (
  exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id
      and (public.can_manage_club(club_group.club_id) or club_group.lead_user_id = auth.uid())
      and exists (
        select 1 from public.club_memberships membership
        where membership.id = membership_id
          and membership.club_id = club_group.club_id
      )
  )
) with check (
  exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id
      and (public.can_manage_club(club_group.club_id) or club_group.lead_user_id = auth.uid())
      and exists (
        select 1 from public.club_memberships membership
        where membership.id = membership_id
          and membership.club_id = club_group.club_id
      )
  )
);
create policy "Public and members can read club templates" on public.club_competition_templates
for select using (
  public.is_club_member(club_id)
  or (
    is_public
    and exists (select 1 from public.clubs club where club.id = club_id and club.is_public)
  )
);
create policy "Club staff can create templates" on public.club_competition_templates
for insert to authenticated with check (
  public.can_run_club_competition(club_id)
  and created_by_user_id = auth.uid()
);
create policy "Club staff can update templates" on public.club_competition_templates
for update to authenticated using (public.can_run_club_competition(club_id)) with check (public.can_run_club_competition(club_id));
create policy "Club managers can delete templates" on public.club_competition_templates
for delete to authenticated using (public.can_manage_club(club_id));
drop policy if exists "Authenticated users can create TIQ leagues" on public.tiq_leagues;
create policy "Authenticated users can create TIQ leagues"
on public.tiq_leagues
for insert to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and competition_layer = 'tiq'
  and (club_id is null or public.can_run_club_competition(club_id))
);
drop policy if exists "Creators can update TIQ leagues" on public.tiq_leagues;
create policy "Creators can update TIQ leagues"
on public.tiq_leagues
for update to authenticated
using (auth.uid() = created_by_user_id)
with check (
  auth.uid() = created_by_user_id
  and updated_by_user_id = auth.uid()
  and competition_layer = 'tiq'
  and (club_id is null or public.can_run_club_competition(club_id))
);
drop policy if exists "Authenticated users can create TIQ tournaments" on public.tiq_tournaments;
create policy "Authenticated users can create TIQ tournaments"
on public.tiq_tournaments
for insert to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and (club_id is null or public.can_run_club_competition(club_id))
);
drop policy if exists "Creators can update TIQ tournaments" on public.tiq_tournaments;
create policy "Creators can update TIQ tournaments"
on public.tiq_tournaments
for update to authenticated
using (auth.uid() = created_by_user_id)
with check (
  auth.uid() = created_by_user_id
  and updated_by_user_id = auth.uid()
  and (club_id is null or public.can_run_club_competition(club_id))
);
create policy "Club members can read club leagues" on public.tiq_leagues
for select using (club_id is not null and public.is_club_member(club_id));
create policy "Club staff can update club leagues" on public.tiq_leagues
for update to authenticated using (club_id is not null and public.can_run_club_competition(club_id))
with check (club_id is not null and public.can_run_club_competition(club_id));
create policy "Club members can read club tournaments" on public.tiq_tournaments
for select using (club_id is not null and public.is_club_member(club_id));
create policy "Club staff can update club tournaments" on public.tiq_tournaments
for update to authenticated using (club_id is not null and public.can_run_club_competition(club_id))
with check (club_id is not null and public.can_run_club_competition(club_id));
revoke all on function public.is_club_member(uuid) from public;
revoke all on function public.can_manage_club(uuid) from public;
revoke all on function public.can_run_club_competition(uuid) from public;
revoke all on function public.get_club_invite_preview(uuid) from public;
revoke all on function public.accept_club_invite(uuid) from public;
grant execute on function public.is_club_member(uuid) to anon, authenticated, service_role;
grant execute on function public.can_manage_club(uuid) to authenticated, service_role;
grant execute on function public.can_run_club_competition(uuid) to authenticated, service_role;
grant execute on function public.get_club_invite_preview(uuid) to anon, authenticated, service_role;
grant execute on function public.accept_club_invite(uuid) to authenticated, service_role;
comment on table public.clubs is 'Persistent club identity, branding, location, and public home for connected TenAceIQ tools.';
comment on table public.club_memberships is 'One club roster with multi-role access for players, coaches, captains, coordinators, and staff.';
comment on table public.club_competition_templates is 'Reusable club defaults for launching League Office and Tournament Desk work.';
