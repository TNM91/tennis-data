alter table public.club_groups
  add column if not exists renewals_finalized_at timestamptz;

create index if not exists club_groups_renewals_finalized_idx
  on public.club_groups (club_id, renewals_finalized_at)
  where renewals_finalized_at is not null;

drop function if exists public.get_club_group_renewal_preview(uuid);
create function public.get_club_group_renewal_preview(target_response_token uuid)
returns table (
  club_name text,
  club_slug text,
  club_logo_url text,
  group_name text,
  group_type text,
  season_label text,
  player_name text,
  renewal_status text,
  expires_at timestamptz,
  finalized_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    club.name,
    club.slug,
    club.logo_url,
    club_group.name,
    club_group.group_type,
    club_group.season_label,
    coalesce(nullif(membership.display_name, ''), nullif(membership.email, ''), 'Player'),
    renewal.status,
    renewal.expires_at,
    club_group.renewals_finalized_at
  from public.club_group_renewals renewal
  join public.clubs club on club.id = renewal.club_id
  join public.club_groups club_group on club_group.id = renewal.group_id and club_group.club_id = renewal.club_id
  join public.club_memberships membership on membership.id = renewal.membership_id and membership.club_id = renewal.club_id
  where renewal.response_token = target_response_token
    and club_group.is_active = true;
$$;

create or replace function public.respond_club_group_renewal(target_response_token uuid, target_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  renewal_group_id uuid;
  renewal_membership_id uuid;
begin
  if target_status not in ('confirmed', 'declined') then
    raise exception 'Choose yes or no.';
  end if;

  update public.club_group_renewals renewal
  set status = target_status,
      responded_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  from public.club_groups club_group
  where renewal.response_token = target_response_token
    and club_group.id = renewal.group_id
    and club_group.club_id = renewal.club_id
    and club_group.is_active = true
    and club_group.renewals_finalized_at is null
    and renewal.expires_at > timezone('utc', now())
  returning renewal.group_id, renewal.membership_id
  into renewal_group_id, renewal_membership_id;

  if renewal_group_id is null then
    raise exception 'This renewal decision is closed or unavailable.';
  end if;

  insert into public.club_group_members (group_id, membership_id, status)
  values (
    renewal_group_id,
    renewal_membership_id,
    case when target_status = 'confirmed' then 'active' else 'inactive' end
  )
  on conflict (group_id, membership_id)
  do update set status = excluded.status;

  return target_status;
end;
$$;

revoke all on function public.get_club_group_renewal_preview(uuid) from public;
revoke all on function public.respond_club_group_renewal(uuid, text) from public;
grant execute on function public.get_club_group_renewal_preview(uuid) to anon, authenticated;
grant execute on function public.respond_club_group_renewal(uuid, text) to anon, authenticated;
