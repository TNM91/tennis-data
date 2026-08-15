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
  expires_at timestamptz
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
    invite.expires_at
  from public.club_invites invite
  join public.clubs club on club.id = invite.club_id
  where invite.invite_token = target_invite_token
  limit 1;
$$;
revoke all on function public.get_club_invite_preview(uuid) from public;
grant execute on function public.get_club_invite_preview(uuid) to anon, authenticated, service_role;
