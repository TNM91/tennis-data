begin;
set local lock_timeout = '5s';

-- The legacy trigger should only skip the fixture write inside the native save
-- transaction. Private transaction markers cannot be set by an API caller.
create table private.native_league_schedule_writes (
  transaction_id xid8 primary key,
  league_id text not null
);
alter table private.native_league_schedule_writes enable row level security;
revoke all on private.native_league_schedule_writes from public, anon, authenticated, service_role;

do $patch$
declare
  source text := replace(pg_get_functiondef('public.native_first_party_save_league_match(uuid,text,timestamptz,uuid,uuid,timestamptz,uuid,uuid,date,time without time zone,text,text,integer,boolean)'::regprocedure), chr(13), '');
  before_write constant text := '  if p_match is null then' || chr(10) || '    insert into public.tiq_league_schedule_items';
  after_write constant text := '  insert into private.native_league_match_operations';
begin
  if position(before_write in source) = 0 or position(after_write in source) = 0 then
    raise exception 'Review the current native league save function before updating its notifications';
  end if;
  source := replace(source, before_write,
    '  insert into private.native_league_schedule_writes values (pg_current_xact_id(), p_league);' || chr(10) || before_write);
  source := replace(source, after_write,
    '  delete from private.native_league_schedule_writes where transaction_id = pg_current_xact_id();' || chr(10) || after_write);
  execute source;
end
$patch$;

create or replace function public.notify_tiq_league_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from private.native_league_schedule_writes w
    where w.transaction_id = pg_current_xact_id_if_assigned() and w.league_id = new.league_id
  ) then
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
