alter table public.internal_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.team_room_message_responses (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  message_id uuid not null references public.internal_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (message_id, profile_id)
);

create index if not exists team_room_message_responses_conversation_idx
  on public.team_room_message_responses (conversation_id, updated_at desc);

alter table public.team_room_message_responses enable row level security;

drop policy if exists "Team Room members can read match replies" on public.team_room_message_responses;
create policy "Team Room members can read match replies"
  on public.team_room_message_responses for select to authenticated
  using (
    exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = team_room_message_responses.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
  );

drop policy if exists "Team Room members can add own match reply" on public.team_room_message_responses;
create policy "Team Room members can add own match reply"
  on public.team_room_message_responses for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = team_room_message_responses.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
  );

drop policy if exists "Team Room members can update own match reply" on public.team_room_message_responses;
create policy "Team Room members can update own match reply"
  on public.team_room_message_responses for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

comment on table public.team_room_message_responses is
  'Authenticated yes, maybe, or no replies to Team Room match and projected-lineup cards.';
