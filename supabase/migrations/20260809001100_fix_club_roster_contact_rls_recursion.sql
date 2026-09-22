create or replace function public.can_read_shared_roster_contact(target_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_roster_contact_shares roster_share
    where roster_share.contact_id = target_contact_id
      and public.can_manage_club(roster_share.club_id)
  );
$$;

create or replace function public.owns_roster_contact(target_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.captain_roster_contacts contact
    where contact.id = target_contact_id
      and contact.captain_user_id = (select auth.uid())
  );
$$;

revoke all on function public.can_read_shared_roster_contact(uuid) from public;
revoke all on function public.owns_roster_contact(uuid) from public;

grant execute on function public.can_read_shared_roster_contact(uuid) to authenticated, service_role;
grant execute on function public.owns_roster_contact(uuid) to authenticated, service_role;

drop policy if exists "Club managers read shared roster contacts" on public.captain_roster_contacts;
create policy "Club managers read shared roster contacts"
on public.captain_roster_contacts
for select to authenticated
using (public.can_read_shared_roster_contact(id));

drop policy if exists "Club managers share their imported roster contacts" on public.club_roster_contact_shares;
create policy "Club managers share their imported roster contacts"
on public.club_roster_contact_shares
for insert to authenticated
with check (
  shared_by_user_id = (select auth.uid())
  and public.can_manage_club(club_id)
  and public.owns_roster_contact(contact_id)
);
