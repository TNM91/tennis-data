alter table public.club_groups
  add column if not exists capacity integer not null default 0,
  add column if not exists location_label text not null default '',
  add column if not exists registration_url text not null default '',
  add column if not exists default_duration_minutes integer not null default 90;

alter table public.club_groups drop constraint if exists club_groups_capacity_check;
alter table public.club_groups add constraint club_groups_capacity_check check (capacity between 0 and 500);
alter table public.club_groups drop constraint if exists club_groups_duration_check;
alter table public.club_groups add constraint club_groups_duration_check check (default_duration_minutes between 15 and 360);

create table if not exists public.club_clinic_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.club_groups(id) on delete cascade,
  title text not null default 'Clinic session',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_label text not null default '',
  court_label text not null default '',
  focus text not null default '',
  plan text not null default '',
  player_next_step text not null default '',
  status text not null default 'scheduled',
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  updated_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_clinic_sessions_time_check check (ends_at > starts_at),
  constraint club_clinic_sessions_status_check check (status in ('scheduled', 'completed', 'canceled'))
);

create index if not exists club_clinic_sessions_group_start_idx
  on public.club_clinic_sessions (group_id, starts_at);

create table if not exists public.club_clinic_attendance (
  session_id uuid not null references public.club_clinic_sessions(id) on delete cascade,
  membership_id uuid not null references public.club_memberships(id) on delete cascade,
  status text not null default 'expected',
  note text not null default '',
  updated_by_user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (session_id, membership_id),
  constraint club_clinic_attendance_status_check check (status in ('expected', 'present', 'absent', 'late', 'excused'))
);

create table if not exists public.club_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.club_groups(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  body text not null,
  kind text not null default 'update',
  created_at timestamptz not null default timezone('utc', now()),
  constraint club_group_messages_body_check check (char_length(btrim(body)) between 1 and 2000),
  constraint club_group_messages_kind_check check (kind in ('announcement', 'update'))
);

create index if not exists club_group_messages_group_created_idx
  on public.club_group_messages (group_id, created_at desc);

drop trigger if exists set_club_clinic_sessions_updated_at on public.club_clinic_sessions;
create trigger set_club_clinic_sessions_updated_at before update on public.club_clinic_sessions
for each row execute function public.set_club_updated_at();

alter table public.club_clinic_sessions enable row level security;
alter table public.club_clinic_attendance enable row level security;
alter table public.club_group_messages enable row level security;

create policy "Clinic members can read sessions" on public.club_clinic_sessions
for select to authenticated using (
  exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id and public.is_club_member(club_group.club_id)
  )
);

create policy "Clinic staff can create sessions" on public.club_clinic_sessions
for insert to authenticated with check (
  created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id
      and club_group.group_type = 'clinic'
      and (public.can_manage_club(club_group.club_id) or club_group.lead_user_id = auth.uid())
  )
);

create policy "Clinic staff can update sessions" on public.club_clinic_sessions
for update to authenticated using (
  exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id
      and (public.can_manage_club(club_group.club_id) or club_group.lead_user_id = auth.uid())
  )
) with check (
  updated_by_user_id = auth.uid()
  and exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id
      and (public.can_manage_club(club_group.club_id) or club_group.lead_user_id = auth.uid())
  )
);

create policy "Clinic managers can delete sessions" on public.club_clinic_sessions
for delete to authenticated using (
  exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id and public.can_manage_club(club_group.club_id)
  )
);

create policy "Clinic members can read attendance" on public.club_clinic_attendance
for select to authenticated using (
  exists (
    select 1
    from public.club_clinic_sessions session
    join public.club_groups club_group on club_group.id = session.group_id
    where session.id = session_id and public.is_club_member(club_group.club_id)
  )
);

create policy "Clinic staff can manage attendance" on public.club_clinic_attendance
for all to authenticated using (
  exists (
    select 1
    from public.club_clinic_sessions session
    join public.club_groups club_group on club_group.id = session.group_id
    where session.id = session_id
      and (public.can_manage_club(club_group.club_id) or club_group.lead_user_id = auth.uid())
  )
) with check (
  updated_by_user_id = auth.uid()
  and exists (
    select 1
    from public.club_clinic_sessions session
    join public.club_groups club_group on club_group.id = session.group_id
    join public.club_memberships membership on membership.id = membership_id
    where session.id = session_id
      and membership.club_id = club_group.club_id
      and (public.can_manage_club(club_group.club_id) or club_group.lead_user_id = auth.uid())
  )
);

create policy "Clinic members can read messages" on public.club_group_messages
for select to authenticated using (
  exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id and public.is_club_member(club_group.club_id)
  )
);

create policy "Clinic members can post messages" on public.club_group_messages
for insert to authenticated with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.club_groups club_group
    join public.club_memberships membership on membership.club_id = club_group.club_id
    left join public.club_group_members group_member
      on group_member.group_id = club_group.id and group_member.membership_id = membership.id
    where club_group.id = group_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and (
        public.can_manage_club(club_group.club_id)
        or club_group.lead_user_id = auth.uid()
        or group_member.status in ('active', 'waitlist')
      )
  )
);

create policy "Message authors and managers can delete messages" on public.club_group_messages
for delete to authenticated using (
  author_user_id = auth.uid()
  or exists (
    select 1 from public.club_groups club_group
    where club_group.id = group_id and public.can_manage_club(club_group.club_id)
  )
);

comment on table public.club_clinic_sessions is 'Recurring clinic schedule, coach plan, and player follow-through for Club Clinic Hub.';
comment on table public.club_clinic_attendance is 'Day-of clinic attendance connected to the club roster.';
comment on table public.club_group_messages is 'Clinic and program updates that stay attached to the club group.';
