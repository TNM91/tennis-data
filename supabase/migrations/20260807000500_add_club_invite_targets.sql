alter table public.club_invites
  add column if not exists target_type text not null default 'club',
  add column if not exists target_id text,
  add column if not exists target_name text not null default '',
  add column if not exists target_group_type text;

alter table public.club_invites
  drop constraint if exists club_invites_target_check;

alter table public.club_invites
  add constraint club_invites_target_check check (
    target_type in ('club', 'group', 'league', 'tournament')
    and (
      (target_type = 'club' and target_id is null)
      or (target_type <> 'club' and nullif(btrim(target_id), '') is not null)
    )
    and (
      target_group_type is null
      or target_group_type in ('clinic', 'team', 'camp', 'development_group', 'league_division', 'tournament_field')
    )
  );

create index if not exists club_invites_target_idx
  on public.club_invites (club_id, target_type, target_id, status);

drop function if exists public.get_club_invite_preview(uuid);

create function public.get_club_invite_preview(target_invite_token uuid)
returns table (
  club_id uuid,
  club_name text,
  club_slug text,
  club_logo_url text,
  invite_email text,
  invite_roles text[],
  invite_status text,
  expires_at timestamptz,
  target_type text,
  target_id text,
  target_name text,
  target_group_type text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    club.id,
    club.name,
    club.slug,
    club.logo_url,
    invite.email,
    invite.roles,
    case
      when invite.status = 'pending' and invite.expires_at <= timezone('utc', now()) then 'expired'
      else invite.status
    end,
    invite.expires_at,
    invite.target_type,
    invite.target_id,
    invite.target_name,
    invite.target_group_type
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
  accepted_membership_id uuid;
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
    joined_at = coalesce(public.club_memberships.joined_at, timezone('utc', now()))
  returning id into accepted_membership_id;

  if invite_record.target_type = 'group' and invite_record.target_id is not null then
    insert into public.club_group_members (group_id, membership_id, status)
    select club_group.id, accepted_membership_id, 'active'
    from public.club_groups club_group
    where club_group.club_id = invite_record.club_id
      and club_group.id::text = invite_record.target_id
      and club_group.is_active = true
    on conflict (group_id, membership_id) do update set status = 'active';
  end if;

  update public.club_invites
  set
    status = 'accepted',
    accepted_by_user_id = auth.uid(),
    accepted_at = timezone('utc', now())
  where id = invite_record.id;

  return invite_record.club_id;
end;
$$;

revoke all on function public.get_club_invite_preview(uuid) from public;
revoke all on function public.accept_club_invite(uuid) from public;
grant execute on function public.get_club_invite_preview(uuid) to anon, authenticated, service_role;
grant execute on function public.accept_club_invite(uuid) to authenticated, service_role;

comment on column public.club_invites.target_type is 'The exact club experience opened after this invitation is accepted.';
