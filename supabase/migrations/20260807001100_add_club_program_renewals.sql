create table if not exists public.club_group_renewals (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  group_id uuid not null references public.club_groups(id) on delete cascade,
  membership_id uuid not null references public.club_memberships(id) on delete cascade,
  response_token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending',
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '45 days'),
  responded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_group_renewals_status_check check (status in ('pending', 'confirmed', 'declined')),
  constraint club_group_renewals_group_member_key unique (group_id, membership_id)
);
create index if not exists club_group_renewals_group_status_idx
  on public.club_group_renewals (group_id, status, updated_at desc);
create index if not exists club_group_renewals_club_status_idx
  on public.club_group_renewals (club_id, status, updated_at desc);
drop trigger if exists set_club_group_renewals_updated_at on public.club_group_renewals;
create trigger set_club_group_renewals_updated_at before update on public.club_group_renewals
for each row execute function public.set_club_updated_at();
alter table public.club_group_renewals enable row level security;
create policy "Club managers can read program renewals" on public.club_group_renewals
for select to authenticated using (public.can_manage_club(club_id));
create policy "Club managers can create program renewals" on public.club_group_renewals
for insert to authenticated with check (
  public.can_manage_club(club_id)
  and created_by_user_id = auth.uid()
  and exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id and club_group.club_id = club_group_renewals.club_id and club_group.is_active
  )
  and exists (
    select 1 from public.club_memberships membership
    where membership.id = membership_id and membership.club_id = club_group_renewals.club_id and membership.status <> 'removed'
  )
);
create policy "Club managers can update program renewals" on public.club_group_renewals
for update to authenticated using (public.can_manage_club(club_id))
with check (
  public.can_manage_club(club_id)
  and exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id and club_group.club_id = club_group_renewals.club_id
  )
  and exists (
    select 1 from public.club_memberships membership
    where membership.id = membership_id and membership.club_id = club_group_renewals.club_id
  )
);
create policy "Club managers can delete program renewals" on public.club_group_renewals
for delete to authenticated using (public.can_manage_club(club_id));
create or replace function public.get_club_group_renewal_preview(target_response_token uuid)
returns table (
  club_name text,
  club_slug text,
  club_logo_url text,
  group_name text,
  group_type text,
  season_label text,
  player_name text,
  renewal_status text,
  expires_at timestamptz
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
    renewal.expires_at
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
    and renewal.expires_at > timezone('utc', now())
  returning renewal.group_id, renewal.membership_id
  into renewal_group_id, renewal_membership_id;

  if renewal_group_id is null then
    raise exception 'This renewal link is unavailable or expired.';
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
