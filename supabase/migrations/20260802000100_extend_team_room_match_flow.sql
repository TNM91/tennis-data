create table if not exists public.team_room_lineup_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  message_id uuid not null references public.internal_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  lineup_version integer not null check (lineup_version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (message_id, profile_id, lineup_version)
);
create index if not exists team_room_lineup_ack_conversation_idx
  on public.team_room_lineup_acknowledgments (conversation_id, updated_at desc);
alter table public.team_room_lineup_acknowledgments enable row level security;
drop policy if exists "Team Room members can read lineup acknowledgments" on public.team_room_lineup_acknowledgments;
create policy "Team Room members can read lineup acknowledgments"
  on public.team_room_lineup_acknowledgments for select to authenticated
  using (
    exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = team_room_lineup_acknowledgments.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
  );
drop policy if exists "Team Room members can add own lineup acknowledgment" on public.team_room_lineup_acknowledgments;
create policy "Team Room members can add own lineup acknowledgment"
  on public.team_room_lineup_acknowledgments for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = team_room_lineup_acknowledgments.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
  );
drop policy if exists "Team Room members can update own lineup acknowledgment" on public.team_room_lineup_acknowledgments;
create policy "Team Room members can update own lineup acknowledgment"
  on public.team_room_lineup_acknowledgments for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create table if not exists public.team_room_reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  message_id uuid not null references public.internal_messages(id) on delete cascade unique,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_at timestamptz not null,
  targets jsonb not null default '[]'::jsonb,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled')),
  sent_at timestamptz null,
  notification_count integer not null default 0 check (notification_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists team_room_reminder_due_idx
  on public.team_room_reminder_schedules (status, reminder_at)
  where status = 'scheduled';
alter table public.team_room_reminder_schedules enable row level security;
drop policy if exists "Team Room members can read reminder schedules" on public.team_room_reminder_schedules;
create policy "Team Room members can read reminder schedules"
  on public.team_room_reminder_schedules for select to authenticated
  using (
    exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = team_room_reminder_schedules.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
  );
drop policy if exists "Team Room leaders can add reminder schedules" on public.team_room_reminder_schedules;
create policy "Team Room leaders can add reminder schedules"
  on public.team_room_reminder_schedules for insert to authenticated
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = team_room_reminder_schedules.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
        and internal_conversation_participants.participant_role = 'coordinator'
    )
  );
drop policy if exists "Team Room leaders can update reminder schedules" on public.team_room_reminder_schedules;
create policy "Team Room leaders can update reminder schedules"
  on public.team_room_reminder_schedules for update to authenticated
  using (
    exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = team_room_reminder_schedules.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
        and internal_conversation_participants.participant_role = 'coordinator'
    )
  );
create table if not exists public.team_room_member_preferences (
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  season_availability text not null default 'ask_me'
    check (season_availability in ('available', 'ask_me', 'unavailable')),
  email_alerts_enabled boolean not null default false,
  browser_alerts_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, profile_id)
);
alter table public.team_room_member_preferences enable row level security;
drop policy if exists "Team Room members can read own preferences" on public.team_room_member_preferences;
create policy "Team Room members can read own preferences"
  on public.team_room_member_preferences for select to authenticated
  using (profile_id = auth.uid());
drop policy if exists "Team Room members can add own preferences" on public.team_room_member_preferences;
create policy "Team Room members can add own preferences"
  on public.team_room_member_preferences for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = team_room_member_preferences.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
  );
drop policy if exists "Team Room members can update own preferences" on public.team_room_member_preferences;
create policy "Team Room members can update own preferences"
  on public.team_room_member_preferences for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
comment on table public.team_room_lineup_acknowledgments is
  'Per-version player acknowledgments for projected lineups shared in Team Rooms.';
comment on table public.team_room_reminder_schedules is
  'Free in-app and opt-in email reminders for unresolved Team Room match actions.';
comment on table public.team_room_member_preferences is
  'Per-team season availability and reminder preferences captured during team invite onboarding.';
