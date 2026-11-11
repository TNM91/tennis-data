create or replace function public.publish_tiq_league_schedule_batch(
  target_league_id text,
  matches jsonb,
  matches_per_start integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2s'
as $$
declare
  actor uuid := auth.uid();
  league public.tiq_leagues%rowtype;
  batch public.tiq_league_schedule_items[];
  roster jsonb;
  existing_ids integer;
  matching_ids integer;
  match_ids jsonb;
  remaining_events integer;
  today date;
  conflict boolean;
begin
  if actor is null or not public.can_manage_tiq_league(target_league_id) then
    return jsonb_build_object('ok', false, 'status', 403, 'message', 'League Office access is required.');
  end if;
  if jsonb_typeof(matches) is distinct from 'array' or matches_per_start is null or matches_per_start not between 1 and 32 then
    return jsonb_build_object('ok', false, 'status', 400, 'message', 'Choose matches and a valid venue capacity.');
  end if;
  if jsonb_array_length(matches) not between 1 and 384 then
    return jsonb_build_object('ok', false, 'status', 400, 'message', 'Choose between 1 and 384 matches.');
  end if;

  select array_agg(candidate) into batch
  from jsonb_populate_recordset(null::public.tiq_league_schedule_items, matches) candidate;
  if (select count(distinct id) from unnest(batch)) <> cardinality(batch)
     or exists (
       select 1 from unnest(batch) row
       where nullif(btrim(row.participant_a_name), '') is null or nullif(btrim(row.participant_b_name), '') is null
          or lower(btrim(regexp_replace(row.participant_a_name, '[[:space:]]+', ' ', 'g')))
            = lower(btrim(regexp_replace(row.participant_b_name, '[[:space:]]+', ' ', 'g')))
          or nullif(row.participant_a_id, '') = nullif(row.participant_b_id, '')
          or length(row.participant_a_name) > 240 or length(row.participant_b_name) > 240
          or length(row.participant_a_id) > 240 or length(row.participant_b_id) > 240
          or nullif(btrim(row.facility), '') is null or length(row.facility) > 160
          or row.scheduled_date is null or not isfinite(row.scheduled_date)
          or row.scheduled_time is null or row.scheduled_time >= time '24:00'
          or extract(second from row.scheduled_time) <> 0
     ) then
    return jsonb_build_object('ok', false, 'status', 400, 'message', 'Check the date, time, venue, and participants on each match.');
  end if;

  -- Ordinary match edits and inserts use the table directly. Keep those writes
  -- outside the brief interval between checking the schedule and inserting.
  lock table public.tiq_league_schedule_items in share row exclusive mode;
  select * into league from public.tiq_leagues where id = target_league_id for share;
  if not found or not public.can_manage_tiq_league(target_league_id) then
    return jsonb_build_object('ok', false, 'status', 403, 'message', 'League Office access is required.');
  end if;

  select count(*), count(*) filter (where
    saved.league_id = target_league_id and saved.created_by_user_id = actor
    and saved.status <> 'cancelled'
    and saved.participant_a_name = btrim(row.participant_a_name)
    and saved.participant_b_name = btrim(row.participant_b_name)
    and saved.participant_a_id is not distinct from nullif(row.participant_a_id, '')
    and saved.participant_b_id is not distinct from nullif(row.participant_b_id, '')
    and saved.scheduled_date = row.scheduled_date and saved.scheduled_time = row.scheduled_time
    and saved.facility = btrim(row.facility)
  ) into existing_ids, matching_ids
  from unnest(batch) row join public.tiq_league_schedule_items saved using (id);
  select jsonb_agg(id order by id) into match_ids from unnest(batch);
  if matching_ids = cardinality(batch) then
    return jsonb_build_object('ok', true, 'ids', match_ids);
  end if;
  if existing_ids > 0 then
    return jsonb_build_object('ok', false, 'status', 409, 'message', 'This batch overlaps a previous save. Refresh the schedule and review it again.');
  end if;

  if league.season_status not in ('draft', 'active')
     or league.scheduling_mode <> 'coordinator_fixed'
     or league.weekly_settings->>'enabled' = 'true'
     or (league.league_format = 'individual' and league.individual_competition_format <> 'round_robin') then
    return jsonb_build_object('ok', false, 'status', 409, 'message', 'This season no longer supports batch scheduling.');
  end if;
  today := (now() at time zone case when exists (
    select 1 from pg_timezone_names where name = league.schedule_time_zone
  ) then league.schedule_time_zone else 'America/Chicago' end)::date;
  if league.starts_on is null or exists (
    select 1 from unnest(batch) row where row.scheduled_date < today
      or row.scheduled_date < league.starts_on
      or row.scheduled_date > coalesce(league.ends_on, league.starts_on + (least(12, league.max_weeks) * 7 - 1))
  ) then
    return jsonb_build_object('ok', false, 'status', 409, 'message', 'Choose upcoming dates within this season.');
  end if;

  with entries as (
    select team_name name, team_entity_id entity_id, entry_status from public.tiq_team_league_entries
    where league.league_format = 'team' and league_id = target_league_id
    union all
    select player_name, player_id, entry_status from public.tiq_player_league_entries
    where league.league_format = 'individual' and league_id = target_league_id
  ), roster_rows as (
    select name, nullif(entity_id, '') entity_id from entries where entry_status = 'active'
    union all
    select name, null from unnest(case when league.league_format = 'team' then league.teams else league.players end) name
    where not exists (select 1 from entries)
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', btrim(name), 'entity_id', entity_id)), '[]') into roster
  from roster_rows;
  if exists (
    select 1
    from unnest(batch) row
    cross join lateral (values (row.participant_a_name, row.participant_a_id), (row.participant_b_name, row.participant_b_id)) side(name, entity_id)
    where not exists (
      select 1 from jsonb_to_recordset(roster) r(name text, entity_id text)
      where r.name = btrim(side.name) and r.entity_id is not distinct from nullif(side.entity_id, '')
    )
  ) then
    return jsonb_build_object('ok', false, 'status', 409, 'message', 'The roster changed. Refresh and preview the matchups again.');
  end if;

  with scheduled as materialized (
    select id, participant_a_name a, nullif(participant_a_id, '') a_id,
      participant_b_name b, nullif(participant_b_id, '') b_id, scheduled_date date, true is_scheduled
    from public.tiq_league_schedule_items
    where league_id = target_league_id and status <> 'cancelled'
  ), played as (
    select schedule_item_id id, team_a_name a, nullif(team_a_id, '') a_id,
      team_b_name b, nullif(team_b_id, '') b_id, match_date date, false is_scheduled
    from public.tiq_team_league_match_events where league.league_format = 'team' and league_id = target_league_id
    union all
    select schedule_item_id, player_a_name, nullif(player_a_id, ''),
      player_b_name, nullif(player_b_id, ''), null::date, false
    from public.tiq_individual_league_results where league.league_format = 'individual' and league_id = target_league_id
  ), history as (
    select * from scheduled union all select * from played
  ), booked as materialized (
    select date, is_scheduled, a_id, b_id,
      lower(btrim(regexp_replace(a, '[[:space:]]+', ' ', 'g'))) a,
      lower(btrim(regexp_replace(b, '[[:space:]]+', ' ', 'g'))) b
    from history
  ), draft as materialized (
    select id, scheduled_date, nullif(participant_a_id, '') a_id, nullif(participant_b_id, '') b_id,
      lower(btrim(regexp_replace(participant_a_name, '[[:space:]]+', ' ', 'g'))) a,
      lower(btrim(regexp_replace(participant_b_name, '[[:space:]]+', ' ', 'g'))) b
    from unnest(batch)
  ), comparisons as (
    select d.scheduled_date = h.date and h.is_scheduled same_day,
      (d.a = h.a or d.a_id = h.a_id) aa,
      (d.a = h.b or d.a_id = h.b_id) ab,
      (d.b = h.a or d.b_id = h.a_id) ba,
      (d.b = h.b or d.b_id = h.b_id) bb
    from draft d cross join booked h
    union all
    select d.scheduled_date = h.scheduled_date,
      (d.a = h.a or d.a_id = h.a_id), (d.a = h.b or d.a_id = h.b_id),
      (d.b = h.a or d.b_id = h.a_id), (d.b = h.b or d.b_id = h.b_id)
    from draft d join draft h on d.id < h.id
  )
  select league.max_match_events - (select count(*) from scheduled) -
    (select count(*) from played p where not exists (select 1 from scheduled s where s.id = p.id)),
    exists (select 1 from comparisons where (aa and bb) or (ab and ba) or (same_day and (aa or ab or ba or bb)))
  into remaining_events, conflict;

  if cardinality(batch) > remaining_events then
    return jsonb_build_object('ok', false, 'status', 409, 'message', 'These matches would exceed the season match limit.');
  end if;
  if conflict then
    return jsonb_build_object('ok', false, 'status', 409, 'message', 'A matchup is already scheduled, recorded, or has a participant booked that day. Refresh and review the draft.');
  end if;

  if exists (
    select 1
    from (
      select scheduled_date, scheduled_time, lower(btrim(regexp_replace(facility, '[[:space:]]+', ' ', 'g'))) site,
        count(*) selected_count
      from unnest(batch) group by 1, 2, 3
    ) slot
    where slot.selected_count + (
      select count(*) from public.tiq_league_schedule_items saved
      where saved.league_id = target_league_id and saved.status <> 'cancelled'
        and saved.scheduled_date = slot.scheduled_date
        and (saved.scheduled_time is null or (
          extract(hour from saved.scheduled_time) = extract(hour from slot.scheduled_time)
          and extract(minute from saved.scheduled_time) = extract(minute from slot.scheduled_time)
        ))
        and lower(btrim(regexp_replace(saved.facility, '[[:space:]]+', ' ', 'g'))) in ('', slot.site)
    ) > matches_per_start
  ) then
    return jsonb_build_object('ok', false, 'status', 409, 'message', 'A venue has more matches at one start time than its selected capacity.');
  end if;

  insert into public.tiq_league_schedule_items (
    id, league_id, league_format, participant_a_name, participant_a_id, participant_b_name, participant_b_id,
    scheduled_date, scheduled_time, facility, status,
    proposed_by_user_id, confirmed_by_user_id, created_by_user_id, updated_by_user_id
  )
  select id, target_league_id, league.league_format, btrim(participant_a_name), nullif(participant_a_id, ''),
    btrim(participant_b_name), nullif(participant_b_id, ''), scheduled_date, scheduled_time, btrim(facility),
    'coordinator_set', actor, actor, actor, actor
  from unnest(batch);
  return jsonb_build_object('ok', true, 'ids', match_ids);
exception
  when data_exception then
    return jsonb_build_object('ok', false, 'status', 400, 'message', 'Check the match details and try again.');
  when lock_not_available then
    return jsonb_build_object('ok', false, 'status', 409, 'message', 'The schedule is being updated. Refresh and review your batch.');
end;
$$;

revoke all on function public.publish_tiq_league_schedule_batch(text, jsonb, integer) from public, anon;
grant execute on function public.publish_tiq_league_schedule_batch(text, jsonb, integer) to authenticated;
