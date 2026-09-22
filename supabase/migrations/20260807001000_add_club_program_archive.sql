alter table public.club_groups
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists club_groups_club_closed_idx
  on public.club_groups (club_id, closed_at desc)
  where closed_at is not null;

comment on column public.club_groups.closed_at is
  'When this Club program became read-only season history.';

comment on column public.club_groups.closed_by_user_id is
  'Club manager who closed this program season.';

drop policy if exists "Public and members can read club groups" on public.club_groups;
create policy "Public and members can read club groups" on public.club_groups
for select using (
  public.is_club_member(club_id)
  or (
    is_active
    and is_public
    and exists (select 1 from public.clubs club where club.id = club_id and club.is_public)
  )
);
