begin;
set local lock_timeout = '5s';

-- The native save transaction writes its own scoped notices. The function
-- setting is restored on return, so website writes still use the legacy trigger.
alter function public.native_first_party_save_league_match(
  uuid,text,timestamptz,uuid,uuid,timestamptz,uuid,uuid,date,time,text,text,integer,boolean
) set tenaceiq.native_league_schedule to 'on';

create or replace function public.notify_tiq_league_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('tenaceiq.native_league_schedule', true) = 'on'
    and current_setting('role', true) in ('service_role', 'postgres', 'none') then
    return new;
  end if;

  if new.status not in ('confirmed', 'coordinator_set') then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.scheduled_date is not distinct from new.scheduled_date
    and old.scheduled_time is not distinct from new.scheduled_time
    and old.facility is not distinct from new.facility
    and old.status is not distinct from new.status then
    return new;
  end if;

  insert into public.internal_notifications (
    recipient_profile_id,
    actor_user_id,
    notification_type,
    title,
    body,
    href
  )
  select distinct
    entry.created_by_user_id,
    new.updated_by_user_id,
    'schedule',
    case
      when tg_op = 'INSERT' then 'League match scheduled'
      when old.status not in ('confirmed', 'coordinator_set') then 'League match scheduled'
      else 'League match changed'
    end,
    concat_ws(
      ' · ',
      new.participant_a_name || ' vs ' || new.participant_b_name,
      to_char(new.scheduled_date, 'Mon FMDD'),
      nullif(to_char(new.scheduled_time, 'FMHH12:MI AM'), ''),
      nullif(trim(new.facility), '')
    ),
    '/compete/schedule#event-' || new.id::text
  from public.tiq_player_league_entries entry
  where entry.league_id::text = new.league_id::text
    and entry.entry_status = 'active'
    and entry.created_by_user_id is not null
    and entry.created_by_user_id is distinct from new.updated_by_user_id
    and (
      (
        nullif(trim(coalesce(entry.player_id, '')), '') is not null
        and entry.player_id::text in (
          coalesce(new.participant_a_id::text, ''),
          coalesce(new.participant_b_id::text, '')
        )
      )
      or lower(trim(entry.player_name)) in (
        lower(trim(new.participant_a_name)),
        lower(trim(new.participant_b_name))
      )
    );

  return new;
end;
$$;

commit;
