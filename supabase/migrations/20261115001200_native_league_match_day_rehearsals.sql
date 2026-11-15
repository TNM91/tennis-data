begin;
set local lock_timeout = '5s';

-- Rehearsal fixtures and results inherit the league's private visibility,
-- including where older site policies also let approved entrants see schedules.
create policy "Rehearsal fixtures are visible to their owner" on public.tiq_league_schedule_items
  as restrictive for select using (
    league_id not like 'tiq-native-league-e79ec308-8b38-4bf8-aac9-%' or exists (
      select 1 from public.tiq_leagues l where l.id = tiq_league_schedule_items.league_id
        and l.created_by_user_id = (select auth.uid())
    )
  );
create policy "Rehearsal results are visible to their owner" on public.tiq_individual_league_results
  as restrictive for select using (
    league_id not like 'tiq-native-league-e79ec308-8b38-4bf8-aac9-%' or exists (
      select 1 from public.tiq_leagues l where l.id = tiq_individual_league_results.league_id
        and l.created_by_user_id = (select auth.uid())
    )
  );

create function pg_temp.patch_match_day_rehearsal(source text, marker text, replacement text)
returns text language plpgsql as $$
begin
  source := replace(source,chr(13),'');
  if length(source)-length(replace(source,marker,'')) <> length(marker) then
    raise exception 'League Match Day rehearsal source changed: %', marker;
  end if;
  return replace(source,marker,replacement);
end;
$$;

-- Reuse the real scheduler, scorecard and approval transactions for this exact
-- owner. Practice can score a future slot immediately and never sends match
-- notifications. Keep public schedule and score projections unchanged.
do $patch$
declare
  source text;
  signature regprocedure;
  score_review constant regprocedure := 'public.native_league_score_review(uuid,text,timestamptz,uuid,boolean,uuid,uuid)'::regprocedure;
  score_save constant regprocedure := 'public.native_league_save_score(uuid,text,timestamptz,uuid,timestamptz,uuid,uuid,text,jsonb,text,boolean,uuid,uuid)'::regprocedure;
  rehearsal constant text := 'private.native_league_entry_rehearsal_open(p_league,p_actor)';
  score_visibility constant text := '(is_public or private.native_testflight_score_league(tiq_leagues,p_actor))';
  individual_visibility constant text := 'and is_public and private.native_published_league_id(id)';
  score_start constant text := $sql$(f.scheduled_date + coalesce(f.scheduled_time,time '00:00')) <= now() at time zone coalesce(nullif(l.schedule_time_zone,''),'America/Chicago')$sql$;
begin
  source := pg_get_functiondef('private.native_published_league_fixture(public.tiq_leagues,public.tiq_league_schedule_items)'::regprocedure);
  execute pg_temp.patch_match_day_rehearsal(source,'select l.is_public and',
    'select (l.is_public or private.native_league_entry_rehearsal_open(l.id,l.created_by_user_id)) and');

  source := pg_get_functiondef('public.native_first_party_league_schedule_review(uuid,text,timestamptz)'::regprocedure);
  source := pg_temp.patch_match_day_rehearsal(source,score_visibility,
    '(' || score_visibility || ' or ' || rehearsal || ')');
  source := pg_temp.patch_match_day_rehearsal(source,$sql$'canPostpone',private.native_league_can_postpone(f)$sql$,
    $sql$'canPostpone',not $sql$ || rehearsal || ' and private.native_league_can_postpone(f)');
  execute pg_temp.patch_match_day_rehearsal(source,'and not exists (select 1 from public.tiq_individual_league_results',
    'and (not ' || rehearsal || $sql$ or not exists (
      select 1 from private.native_league_scorecards where match_id = f.id
        and fixture_digest = private.native_league_fixture_digest(f)))
    and not exists (select 1 from public.tiq_individual_league_results$sql$);

  source := pg_get_functiondef('public.native_first_party_save_league_match(uuid,text,timestamptz,uuid,uuid,timestamptz,uuid,uuid,date,time,text,text,integer,boolean)'::regprocedure);
  source := pg_temp.patch_match_day_rehearsal(source,'id = p_actor and (','id = p_actor and (' || rehearsal || ' or ');
  source := pg_temp.patch_match_day_rehearsal(source,'(is_public or (p_match is not null',
    '(is_public or ' || rehearsal || ' or (p_match is not null');
  source := pg_temp.patch_match_day_rehearsal(source,$sql$or (not l.is_public and previous.status <> 'postponed'$sql$,
    $sql$or (not l.is_public and previous.status <> 'postponed' and not $sql$ || rehearsal);
  source := pg_temp.patch_match_day_rehearsal(source,'or exists (select 1 from public.tiq_individual_league_results r where r.schedule_item_id = p_match)',
    'or (' || rehearsal || $sql$ and exists (
      select 1 from private.native_league_scorecards where match_id = p_match
        and fixture_digest = private.native_league_fixture_digest(previous)))
      or exists (select 1 from public.tiq_individual_league_results r where r.schedule_item_id = p_match)$sql$);
  execute pg_temp.patch_match_day_rehearsal(source,'if p_notify then','if p_notify and not ' || rehearsal || ' then');

  foreach signature in array array[score_review,score_save] loop
    source := pg_temp.patch_match_day_rehearsal(pg_get_functiondef(signature),score_visibility,
      '(' || score_visibility || ' or ' || rehearsal || ')');
    source := pg_temp.patch_match_day_rehearsal(source,individual_visibility,
      'and ((is_public and private.native_published_league_id(id)) or ' || rehearsal || ')');
    if signature = score_review then
      source := pg_temp.patch_match_day_rehearsal(source,score_start,'(' || rehearsal || ' or ' || score_start || ')');
      source := pg_temp.patch_match_day_rehearsal(source,'private.native_published_league_owner(l,p_actor) or',
        rehearsal || ' or private.native_published_league_owner(l,p_actor) or');
    else
      source := pg_temp.patch_match_day_rehearsal(source,'recipient is not null and',
        'recipient is not null and not ' || rehearsal || ' and');
    end if;
    execute source;
  end loop;

  source := pg_get_functiondef('public.native_individual_league_match_day(text,timestamptz,uuid[],uuid,boolean)'::regprocedure);
  source := pg_temp.patch_match_day_rehearsal(source,'and l.is_public',
    'and (l.is_public or ' || rehearsal || ')');
  source := pg_temp.patch_match_day_rehearsal(source,'and private.native_published_league_owner(l,p_actor)',
    'and (private.native_published_league_owner(l,p_actor) or ' || rehearsal || ')');
  execute pg_temp.patch_match_day_rehearsal(source,$sql$f.scheduled_date + coalesce(f.scheduled_time,time '00:00') <=
              now() at time zone coalesce(nullif(l.schedule_time_zone,''),'America/Chicago')$sql$,
    '(' || rehearsal || $sql$ or f.scheduled_date + coalesce(f.scheduled_time,time '00:00') <=
              now() at time zone coalesce(nullif(l.schedule_time_zone,''),'America/Chicago'))$sql$);
end $patch$;
drop function pg_temp.patch_match_day_rehearsal(text,text,text);

-- Attach only attested fixtures and approved results to the rehearsal's
-- existing account-scoped detail read. Catalog reads need only league metadata.
create function private.native_league_rehearsal_match_day(l public.tiq_leagues)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'fixtures',coalesce(jsonb_agg(jsonb_build_object(
      'match',private.native_league_scheduled_match(f,o.court,o.duration_minutes),'original',o.original_fixture
    ) order by f.scheduled_date desc,f.id),'[]'::jsonb),
    'results',coalesce(jsonb_agg(score.result order by f.scheduled_date desc,f.id)
      filter (where score.result is not null),'[]'::jsonb))
  from public.tiq_league_schedule_items f
  join private.native_league_match_operations o on o.match_id = f.id and o.match_version = f.updated_at
    and o.match_digest = private.native_league_fixture_digest(f)
  left join private.native_league_scorecards c on c.match_id = f.id and c.state = 'approved'
  cross join lateral (select private.native_individual_official_score(l,f,c) result) score
  where f.league_id = l.id and f.status = 'coordinator_set'
    and private.native_published_league_fixture(l,f);
$$;
revoke all on function private.native_league_rehearsal_match_day(public.tiq_leagues)
  from public,anon,authenticated,service_role;

create or replace function public.native_league_entry_rehearsal(p_league text)
returns jsonb language sql stable security definer set search_path = ''
set statement_timeout = '5s' as $$
  select to_jsonb(source) from (
    select l.id,l.created_by_user_id,l.league_name,l.league_format,l.season_label,l.season_status,
      l.flight,l.location_label,l.starts_on,l.ends_on,l.schedule_time_zone,l.updated_at,
      l.scoring_system,l.competition_rules,l.is_public,l.third_set_rule,
      case when p_league is not null then private.native_league_rehearsal_match_day(l) end as match_day
    from private.native_league_entry_rehearsals rehearsal
    join public.tiq_leagues l on l.id = rehearsal.league_id
    where rehearsal.owner_id = (select auth.uid()) and (p_league is null or p_league = l.id)
      and private.native_league_entry_rehearsal_open(l.id,(select auth.uid()))
  ) source;
$$;

notify pgrst,'reload schema';
commit;
