begin;
set local lock_timeout = '5s';

-- Only the operator can create, publish, or edit the private testing season.
create policy "Score review test league IDs are reserved" on public.tiq_leagues
  as restrictive for insert to anon, authenticated with check (id not like 'tiq-testflight-scores-%');
create policy "Score review test leagues cannot be edited by clients" on public.tiq_leagues
  as restrictive for update to anon, authenticated
  using (id not like 'tiq-testflight-scores-%') with check (id not like 'tiq-testflight-scores-%');
create policy "Score review test leagues cannot be deleted by clients" on public.tiq_leagues
  as restrictive for delete to anon, authenticated using (id not like 'tiq-testflight-scores-%');

create function private.native_testflight_score_league(l public.tiq_leagues, actor uuid)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(l.id = 'tiq-testflight-scores-' || actor::text
    and l.created_by_user_id = actor and not l.is_public and l.league_format='team' and l.season_status='active',false);
$$;
revoke all on function private.native_testflight_score_league(public.tiq_leagues,uuid) from public, anon, authenticated;

-- Keep the current review, receipt, approval, and notice rules. Widen only the
-- exact owner-only test season and the explicitly recorded court outcomes.
do $patch$
declare
  review_sql text := replace(pg_get_functiondef('public.native_league_score_review(uuid,text,timestamptz,uuid,boolean,uuid,uuid)'::regprocedure),chr(13),'');
  save_sql text := replace(pg_get_functiondef('public.native_league_save_score(uuid,text,timestamptz,uuid,timestamptz,uuid,uuid,text,jsonb,text,boolean,uuid,uuid)'::regprocedure),chr(13),'');
  visibility constant text := 'updated_at = p_version and is_public';
  allowed constant text := 'updated_at = p_version and (is_public or private.native_testflight_score_league(tiq_leagues,p_actor))';
  submit_guard constant text := 'p_actor and (p.role = ''admin''';
  score_check constant text := 'length(coalesce(line->>''score'','''')) not between 1 and 64';
  official_score constant text := 'line->>''winner'', line->>''score'', p_actor,p_actor';
  notice_sql text := pg_get_functiondef('private.native_league_score_updates()'::regprocedure);
  notice_guard constant text := 'and l.is_public and l.season_status';
  recipient_guard constant text := 'recipient is not null and recipient <> p_actor';
begin
  if position(visibility in review_sql)=0 or position(visibility in save_sql)=0 or position(submit_guard in review_sql)=0
    or position(score_check in save_sql)=0 or position(official_score in save_sql)=0
    or position(recipient_guard in save_sql)=0 or position(notice_guard in notice_sql)=0
  then raise exception 'Score review source changed; check the migration'; end if;

  review_sql := replace(review_sql,visibility,allowed);
  review_sql := replace(review_sql,submit_guard,'p_actor and (private.native_testflight_score_league(l,p_actor) or p.role = ''admin''');
  execute review_sql;

  save_sql := replace(save_sql,visibility,allowed);
  save_sql := replace(save_sql,recipient_guard,
    'recipient is not null and (recipient <> p_actor or private.native_testflight_score_league(l,p_actor))');
  save_sql := replace(save_sql,score_check,$sql$
    (jsonb_typeof(line->'score') is distinct from 'string')
    or (case coalesce(line->>'outcome','played')
      when 'played' then length(line->>'score') not between 1 and 64
        or line->>'score' !~ '^[0-9(), -]+$'
      when 'walkover' then line->>'score' <> ''
      when 'retirement' then length(line->>'score') > 64 or line->>'score' !~ '^[0-9(), -]*$'
      else true
    end)$sql$);
  save_sql := replace(save_sql,official_score,$sql$line->>'winner',
    case line->>'outcome'
      when 'walkover' then 'Walkover'
      when 'retirement' then concat_ws(' · ','Retired',nullif(line->>'score',''))
      else line->>'score'
    end,p_actor,p_actor$sql$);
  execute save_sql;
  execute replace(notice_sql,notice_guard,
    'and (l.is_public or private.native_testflight_score_league(l,n.recipient_profile_id)) and l.season_status');
end $patch$;

notify pgrst, 'reload schema';
commit;
