create table if not exists public.internal_schedule_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  event_type text not null default 'captain_practice'
    check (event_type in ('tiq_league_match', 'captain_practice')),
  title text not null default '',
  scheduled_date date not null,
  scheduled_time text not null default '',
  facility text not null default '',
  recurrence_rule text not null default '',
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'cancelled', 'completed')),
  source_entity_type text not null default '',
  source_entity_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.internal_schedule_event_responses (
  event_id uuid not null references public.internal_schedule_events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  response_status text not null default 'unanswered'
    check (response_status in ('in', 'out', 'maybe', 'unanswered')),
  note text not null default '',
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (event_id, profile_id)
);

create index if not exists internal_schedule_events_conversation_idx
  on public.internal_schedule_events (conversation_id, scheduled_date, scheduled_time);

create index if not exists internal_schedule_events_source_idx
  on public.internal_schedule_events (source_entity_type, source_entity_id);

create index if not exists internal_schedule_event_responses_profile_idx
  on public.internal_schedule_event_responses (profile_id, event_id);

alter table public.internal_schedule_events enable row level security;
alter table public.internal_schedule_event_responses enable row level security;

drop policy if exists "Conversation participants can create schedule events" on public.internal_schedule_events;
create policy "Conversation participants can create schedule events"
  on public.internal_schedule_events for insert to authenticated
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = internal_schedule_events.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
  );

drop policy if exists "Conversation participants can read schedule events" on public.internal_schedule_events;
create policy "Conversation participants can read schedule events"
  on public.internal_schedule_events for select to authenticated
  using (
    exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = internal_schedule_events.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Event creators and admins can update schedule events" on public.internal_schedule_events;
create policy "Event creators and admins can update schedule events"
  on public.internal_schedule_events for update to authenticated
  using (
    created_by_user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    created_by_user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Participants can create schedule responses" on public.internal_schedule_event_responses;
create policy "Participants can create schedule responses"
  on public.internal_schedule_event_responses for insert to authenticated
  with check (
    (
      profile_id = auth.uid()
      and exists (
        select 1 from public.internal_schedule_events
        join public.internal_conversation_participants
          on internal_conversation_participants.conversation_id = internal_schedule_events.conversation_id
        where internal_schedule_events.id = internal_schedule_event_responses.event_id
          and internal_conversation_participants.profile_id = auth.uid()
      )
    )
    or exists (
      select 1 from public.internal_schedule_events
      where internal_schedule_events.id = internal_schedule_event_responses.event_id
        and internal_schedule_events.created_by_user_id = auth.uid()
    )
  );

drop policy if exists "Participants can read schedule responses" on public.internal_schedule_event_responses;
create policy "Participants can read schedule responses"
  on public.internal_schedule_event_responses for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.internal_schedule_events
      join public.internal_conversation_participants
        on internal_conversation_participants.conversation_id = internal_schedule_events.conversation_id
      where internal_schedule_events.id = internal_schedule_event_responses.event_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Participants can update their schedule responses" on public.internal_schedule_event_responses;
create policy "Participants can update their schedule responses"
  on public.internal_schedule_event_responses for update to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
