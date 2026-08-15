create or replace function public.is_internal_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_conversation_participants participants
    where participants.conversation_id = target_conversation_id
      and participants.profile_id = (select auth.uid())
  );
$$;
create or replace function public.is_internal_conversation_creator(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_conversations conversations
    where conversations.id = target_conversation_id
      and conversations.created_by_user_id = (select auth.uid())
  );
$$;
create or replace function public.is_internal_schedule_event_participant(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_schedule_events events
    join public.internal_conversation_participants participants
      on participants.conversation_id = events.conversation_id
    where events.id = target_event_id
      and participants.profile_id = (select auth.uid())
  );
$$;
create or replace function public.is_internal_schedule_event_creator(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_schedule_events events
    where events.id = target_event_id
      and events.created_by_user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_internal_conversation_participant(uuid) from public;
revoke all on function public.is_internal_conversation_creator(uuid) from public;
revoke all on function public.is_internal_schedule_event_participant(uuid) from public;
revoke all on function public.is_internal_schedule_event_creator(uuid) from public;
grant execute on function public.is_internal_conversation_participant(uuid) to authenticated, service_role;
grant execute on function public.is_internal_conversation_creator(uuid) to authenticated, service_role;
grant execute on function public.is_internal_schedule_event_participant(uuid) to authenticated, service_role;
grant execute on function public.is_internal_schedule_event_creator(uuid) to authenticated, service_role;
drop policy if exists "Participants and admins can read internal conversations" on public.internal_conversations;
create policy "Participants and admins can read internal conversations"
  on public.internal_conversations for select to authenticated
  using (
    created_by_user_id = (select auth.uid())
    or assigned_admin_user_id = (select auth.uid())
    or public.is_internal_conversation_participant(id)
    or public.is_admin()
  );
drop policy if exists "Owners and admins can update internal conversations" on public.internal_conversations;
create policy "Owners and admins can update internal conversations"
  on public.internal_conversations for update to authenticated
  using (
    created_by_user_id = (select auth.uid())
    or assigned_admin_user_id = (select auth.uid())
    or public.is_admin()
  )
  with check (
    created_by_user_id = (select auth.uid())
    or assigned_admin_user_id = (select auth.uid())
    or public.is_admin()
  );
drop policy if exists "Conversation creators can add participants" on public.internal_conversation_participants;
create policy "Conversation creators can add participants"
  on public.internal_conversation_participants for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    or public.is_internal_conversation_creator(conversation_id)
    or public.is_admin()
  );
drop policy if exists "Participants and admins can read participants" on public.internal_conversation_participants;
create policy "Participants and admins can read participants"
  on public.internal_conversation_participants for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_internal_conversation_creator(conversation_id)
    or public.is_admin()
  );
drop policy if exists "Participants can update their read state" on public.internal_conversation_participants;
create policy "Participants can update their read state"
  on public.internal_conversation_participants for update to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_admin()
  )
  with check (
    profile_id = (select auth.uid())
    or public.is_admin()
  );
drop policy if exists "Participants can create internal messages" on public.internal_messages;
create policy "Participants can create internal messages"
  on public.internal_messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and (
      public.is_internal_conversation_participant(conversation_id)
      or public.is_internal_conversation_creator(conversation_id)
      or public.is_admin()
    )
  );
drop policy if exists "Participants and admins can read internal messages" on public.internal_messages;
create policy "Participants and admins can read internal messages"
  on public.internal_messages for select to authenticated
  using (
    sender_user_id = (select auth.uid())
    or public.is_internal_conversation_participant(conversation_id)
    or public.is_internal_conversation_creator(conversation_id)
    or public.is_admin()
  );
drop policy if exists "Conversation participants can create schedule events" on public.internal_schedule_events;
create policy "Conversation participants can create schedule events"
  on public.internal_schedule_events for insert to authenticated
  with check (
    created_by_user_id = (select auth.uid())
    and public.is_internal_conversation_participant(conversation_id)
  );
drop policy if exists "Conversation participants can read schedule events" on public.internal_schedule_events;
create policy "Conversation participants can read schedule events"
  on public.internal_schedule_events for select to authenticated
  using (
    public.is_internal_conversation_participant(conversation_id)
    or public.is_admin()
  );
drop policy if exists "Event creators and admins can update schedule events" on public.internal_schedule_events;
create policy "Event creators and admins can update schedule events"
  on public.internal_schedule_events for update to authenticated
  using (
    created_by_user_id = (select auth.uid())
    or public.is_admin()
  )
  with check (
    created_by_user_id = (select auth.uid())
    or public.is_admin()
  );
drop policy if exists "Participants can create schedule responses" on public.internal_schedule_event_responses;
create policy "Participants can create schedule responses"
  on public.internal_schedule_event_responses for insert to authenticated
  with check (
    (
      profile_id = (select auth.uid())
      and public.is_internal_schedule_event_participant(event_id)
    )
    or public.is_internal_schedule_event_creator(event_id)
  );
drop policy if exists "Participants can read schedule responses" on public.internal_schedule_event_responses;
create policy "Participants can read schedule responses"
  on public.internal_schedule_event_responses for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_internal_schedule_event_participant(event_id)
    or public.is_admin()
  );
drop policy if exists "Participants can update their schedule responses" on public.internal_schedule_event_responses;
create policy "Participants can update their schedule responses"
  on public.internal_schedule_event_responses for update to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_admin()
  )
  with check (
    profile_id = (select auth.uid())
    or public.is_admin()
  );
drop policy if exists "Users can create internal notifications" on public.internal_notifications;
create policy "Users can create internal notifications"
  on public.internal_notifications for insert to authenticated
  with check (
    actor_user_id = (select auth.uid())
    or public.is_admin()
  );
drop policy if exists "Recipients and admins can read internal notifications" on public.internal_notifications;
create policy "Recipients and admins can read internal notifications"
  on public.internal_notifications for select to authenticated
  using (
    recipient_profile_id = (select auth.uid())
    or public.is_admin()
  );
drop policy if exists "Recipients can update internal notifications" on public.internal_notifications;
create policy "Recipients can update internal notifications"
  on public.internal_notifications for update to authenticated
  using (
    recipient_profile_id = (select auth.uid())
    or public.is_admin()
  )
  with check (
    recipient_profile_id = (select auth.uid())
    or public.is_admin()
  );
drop policy if exists "Users can read notification preferences" on public.internal_notification_preferences;
create policy "Users can read notification preferences"
  on public.internal_notification_preferences for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_admin()
  );
