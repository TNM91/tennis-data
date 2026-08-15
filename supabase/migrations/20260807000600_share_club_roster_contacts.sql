create table if not exists public.club_roster_contact_shares (
  contact_id uuid not null references public.captain_roster_contacts(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  shared_by_user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (contact_id, club_id)
);
create index if not exists club_roster_contact_shares_club_idx
  on public.club_roster_contact_shares (club_id, created_at desc);
alter table public.club_roster_contact_shares enable row level security;
drop policy if exists "Captains manage their imported roster contacts" on public.captain_roster_contacts;
drop policy if exists "Captains read their imported roster contacts" on public.captain_roster_contacts;
drop policy if exists "Captains add their imported roster contacts" on public.captain_roster_contacts;
drop policy if exists "Captains update their imported roster contacts" on public.captain_roster_contacts;
drop policy if exists "Captains delete their imported roster contacts" on public.captain_roster_contacts;
drop policy if exists "Club managers read shared roster contacts" on public.captain_roster_contacts;
create policy "Captains read their imported roster contacts"
on public.captain_roster_contacts
for select to authenticated
using (captain_user_id = auth.uid());
create policy "Captains add their imported roster contacts"
on public.captain_roster_contacts
for insert to authenticated
with check (captain_user_id = auth.uid());
create policy "Captains update their imported roster contacts"
on public.captain_roster_contacts
for update to authenticated
using (captain_user_id = auth.uid())
with check (captain_user_id = auth.uid());
create policy "Captains delete their imported roster contacts"
on public.captain_roster_contacts
for delete to authenticated
using (captain_user_id = auth.uid());
create policy "Club managers read shared roster contacts"
on public.captain_roster_contacts
for select to authenticated
using (
  exists (
    select 1
    from public.club_roster_contact_shares roster_share
    where roster_share.contact_id = id
      and public.can_manage_club(roster_share.club_id)
  )
);
create policy "Club managers read roster contact shares"
on public.club_roster_contact_shares
for select to authenticated
using (shared_by_user_id = auth.uid() or public.can_manage_club(club_id));
create policy "Club managers share their imported roster contacts"
on public.club_roster_contact_shares
for insert to authenticated
with check (
  shared_by_user_id = auth.uid()
  and public.can_manage_club(club_id)
  and exists (
    select 1
    from public.captain_roster_contacts contact
    where contact.id = contact_id
      and contact.captain_user_id = auth.uid()
  )
);
create policy "Uploaders and club managers stop roster contact sharing"
on public.club_roster_contact_shares
for delete to authenticated
using (shared_by_user_id = auth.uid() or public.can_manage_club(club_id));
comment on table public.club_roster_contact_shares is
  'Explicit, revocable permission for authorized managers of one club to use selected imported roster contacts.';
