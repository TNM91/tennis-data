-- Create the next due occurrence when the captain opens the practice hub.
-- Lock each source so concurrent loads cannot create duplicate weeks.
create or replace function public.advance_captain_practices()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.internal_schedule_events%rowtype;
  old_invite public.captain_practice_invites%rowtype;
  new_event uuid;
  new_invite uuid;
  new_token uuid;
  next_date date;
  interval_days integer;
  today date := (now() at time zone 'America/Chicago')::date;
begin
  if auth.uid() is null then raise exception 'Sign in to manage practices'; end if;
  for source in
    select * from public.internal_schedule_events
    where created_by_user_id = auth.uid() and event_type = 'captain_practice'
      and status in ('proposed', 'confirmed', 'completed')
      and recurrence_rule in ('weekly', 'biweekly') and scheduled_date < today
      and not (metadata ? 'nextPracticeId')
    for update
  loop
    -- Recheck after acquiring the lock, including concurrent requests.
    if exists (select 1 from public.internal_schedule_events where id = source.id and metadata ? 'nextPracticeId') then continue; end if;
    select * into old_invite from public.captain_practice_invites where event_id = source.id;
    if old_invite.id is null then continue; end if;
    interval_days := case source.recurrence_rule when 'biweekly' then 14 else 7 end;
    next_date := source.scheduled_date + (((today - source.scheduled_date + interval_days - 1) / interval_days) * interval_days);
    new_event := gen_random_uuid(); new_invite := gen_random_uuid(); new_token := gen_random_uuid();
    insert into public.internal_schedule_events
      (id, conversation_id, event_type, title, scheduled_date, scheduled_time, facility,
       recurrence_rule, source_entity_type, source_entity_id, metadata, created_by_user_id)
    values (new_event, source.conversation_id, source.event_type, source.title, next_date,
      source.scheduled_time, source.facility, source.recurrence_rule, source.source_entity_type,
      source.source_entity_id || '-' || next_date::text,
      (source.metadata - 'nextPracticeId') || jsonb_build_object('scheduleDate', next_date::text, 'publicToken', new_token::text, 'previousPracticeId', source.id::text), auth.uid());
    insert into public.captain_practice_invites (id, event_id, public_token, capacity, created_by_user_id)
    values (new_invite, new_event, new_token, old_invite.capacity, auth.uid());
    insert into public.captain_practice_invitees
      (invite_id, event_id, player_id, profile_id, player_name, normalized_name, phone)
    select new_invite, new_event, player_id, profile_id, player_name, normalized_name, phone
    from public.captain_practice_invitees where invite_id = old_invite.id;
    insert into public.internal_schedule_event_responses (event_id, profile_id)
    select new_event, profile_id from public.internal_schedule_event_responses where event_id = source.id;
    update public.internal_schedule_events
      set metadata = metadata || jsonb_build_object('nextPracticeId', new_event::text), updated_at = now()
      where id = source.id;
  end loop;
end;
$$;
revoke all on function public.advance_captain_practices() from public, anon;
grant execute on function public.advance_captain_practices() to authenticated;
