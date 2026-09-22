create table if not exists public.club_communication_reads (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_type text not null,
  channel_id uuid not null,
  last_read_at timestamptz not null default timezone('utc', now()),
  primary key (club_id, user_id, channel_type, channel_id),
  constraint club_communication_reads_channel_type_check
    check (channel_type in ('team', 'clinic'))
);

create index if not exists club_communication_reads_user_idx
  on public.club_communication_reads (user_id, club_id, last_read_at desc);

alter table public.club_communication_reads enable row level security;

create policy "Club staff can read own communication markers"
  on public.club_communication_reads for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.club_memberships membership
      where membership.club_id = club_communication_reads.club_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.roles && array['owner', 'admin', 'director', 'coach', 'captain', 'coordinator']::text[]
    )
  );

create policy "Club staff can add own communication markers"
  on public.club_communication_reads for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.club_memberships membership
      where membership.club_id = club_communication_reads.club_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.roles && array['owner', 'admin', 'director', 'coach', 'captain', 'coordinator']::text[]
    )
  );

create policy "Club staff can update own communication markers"
  on public.club_communication_reads for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.club_memberships membership
      where membership.club_id = club_communication_reads.club_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.roles && array['owner', 'admin', 'director', 'coach', 'captain', 'coordinator']::text[]
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.club_memberships membership
      where membership.club_id = club_communication_reads.club_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.roles && array['owner', 'admin', 'director', 'coach', 'captain', 'coordinator']::text[]
    )
  );

comment on table public.club_communication_reads is
  'Per-staff read markers for the Club communication follow-up view.';
