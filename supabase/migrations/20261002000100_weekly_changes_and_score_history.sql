-- Preserve published plans and score provenance; only league managers see requests/audits.
create table public.tiq_league_weekly_change_requests (
  session_id uuid not null references public.tiq_league_weekly_sessions(id) on delete cascade,
  player_name text not null,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  requested_at timestamptz not null default now(),
  primary key (session_id, player_name)
);
create table public.tiq_league_weekly_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tiq_league_weekly_sessions(id) on delete cascade,
  before_plan jsonb not null,
  after_plan jsonb not null,
  affected_names text[] not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null
);
create table public.tiq_league_weekly_score_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tiq_league_weekly_sessions(id) on delete cascade,
  court_number integer not null,
  set_number integer not null,
  previous_score jsonb,
  next_score jsonb not null,
  changed_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null
);
alter table public.tiq_league_weekly_change_requests enable row level security;
create index weekly_plan_revisions_session_idx on public.tiq_league_weekly_plan_revisions(session_id, created_at desc);
create index weekly_score_history_session_idx on public.tiq_league_weekly_score_history(session_id, changed_at desc);
alter table public.tiq_league_weekly_plan_revisions enable row level security;
alter table public.tiq_league_weekly_score_history enable row level security;
create policy weekly_requests_manager on public.tiq_league_weekly_change_requests for select to authenticated using (
  exists(select 1 from public.tiq_league_weekly_sessions s where s.id = session_id and public.can_manage_tiq_league(s.league_id))
);
create policy weekly_revisions_manager on public.tiq_league_weekly_plan_revisions for select to authenticated using (
  exists(select 1 from public.tiq_league_weekly_sessions s where s.id = session_id and public.can_manage_tiq_league(s.league_id))
);
create policy weekly_score_history_manager on public.tiq_league_weekly_score_history for select to authenticated using (
  exists(select 1 from public.tiq_league_weekly_sessions s where s.id = session_id and public.can_manage_tiq_league(s.league_id))
);
grant select on public.tiq_league_weekly_change_requests, public.tiq_league_weekly_plan_revisions, public.tiq_league_weekly_score_history to authenticated;

create function public.audit_weekly_plan_change() returns trigger language plpgsql security definer set search_path = public as $$
declare affected text[]; old_court jsonb; next_court jsonb;
begin
  if old.assignments is not distinct from new.assignments then return new; end if;
  if old.status = 'completed' then raise exception 'A completed week is read-only. Choose a new week.'; end if;
  for old_court in select value from jsonb_array_elements(old.assignments) loop
    select value into next_court from jsonb_array_elements(new.assignments) where value->>'courtNumber' = old_court->>'courtNumber';
    if (old_court->'players' is distinct from next_court->'players' or old_court->'sets' is distinct from next_court->'sets') and (
      exists(select 1 from tiq_league_weekly_set_results where session_id = old.id and court_number = (old_court->>'courtNumber')::integer) or
      exists(select 1 from tiq_league_weekly_score_submissions where session_id = old.id and court_number = (old_court->>'courtNumber')::integer)
    ) then raise exception 'This court has submitted scores. Its players and sets cannot be reassigned.'; end if;
  end loop;
  if old.status in ('published', 'roster_confirmed') then
    select array_agg(distinct player) into affected from (
      select jsonb_array_elements_text(c->'players') player from (
        select value c from jsonb_array_elements(old.assignments) o where not exists(select 1 from jsonb_array_elements(new.assignments) n where n.value = o.value)
        union all
        select value c from jsonb_array_elements(new.assignments) n where not exists(select 1 from jsonb_array_elements(old.assignments) o where o.value = n.value)
      ) changed
    ) names;
    insert into tiq_league_weekly_plan_revisions(session_id, before_plan, after_plan, affected_names, actor_user_id)
      values(old.id, old.assignments, new.assignments, coalesce(affected, '{}'::text[]), auth.uid());
  end if;
  return new;
end $$;
create trigger weekly_plan_change before update of assignments on public.tiq_league_weekly_sessions for each row execute function public.audit_weekly_plan_change();

create function public.audit_weekly_score_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or to_jsonb(old) is distinct from to_jsonb(new) then
    insert into tiq_league_weekly_score_history(session_id, court_number, set_number, previous_score, next_score, actor_user_id)
    values(new.session_id, new.court_number, new.set_number, case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new), coalesce(auth.uid(), new.approved_by_user_id));
  end if;
  return new;
end $$;
create trigger weekly_score_change after insert or update on public.tiq_league_weekly_set_results for each row execute function public.audit_weekly_score_change();

-- Serialize first score submissions with substitutions, and reject stale pairings.
create function public.guard_weekly_score_plan() returns trigger language plpgsql security definer set search_path = public as $$
declare plan jsonb; court jsonb; matchup jsonb;
begin
  select assignments into plan from tiq_league_weekly_sessions where id = new.session_id for update;
  select value into court from jsonb_array_elements(plan) where (value->>'courtNumber')::integer = new.court_number;
  select value into matchup from jsonb_array_elements(court->'sets') where (value->>'setNumber')::integer = new.set_number;
  if matchup is null then raise exception 'This set is no longer in the published plan.'; end if;
  if tg_table_name = 'tiq_league_weekly_score_submissions' then
    if not (court->'players' ? new.submitted_by_name) then raise exception 'This player is no longer assigned to this court.'; end if;
  else
    if to_jsonb(new.side_a_players) is distinct from matchup->'sideA' or to_jsonb(new.side_b_players) is distinct from matchup->'sideB' then raise exception 'Court partners changed. Refresh before submitting scores.'; end if;
    if tg_op = 'UPDATE' and old.review_status = 'approved' and new.review_status <> 'approved' then raise exception 'The league-approved score remains official.'; end if;
    if tg_op = 'UPDATE' and old.review_status = 'confirmed' and new.review_status = 'pending' then
      new.review_status := case when old.side_a_games = new.side_a_games and old.side_b_games = new.side_b_games then 'confirmed' else 'disputed' end;
    end if;
    if tg_op = 'UPDATE' and old.review_status in ('approved', 'confirmed') and new.review_status = 'approved'
       and (old.side_a_games <> new.side_a_games or old.side_b_games <> new.side_b_games) and length(trim(coalesce(new.review_note, ''))) = 0 then raise exception 'Add a reason before correcting an official score.'; end if;
  end if;
  return new;
end $$;
create trigger weekly_result_plan_guard before insert or update on public.tiq_league_weekly_set_results for each row execute function public.guard_weekly_score_plan();
create trigger weekly_submission_plan_guard before insert or update on public.tiq_league_weekly_score_submissions for each row execute function public.guard_weekly_score_plan();

create function public.replace_tiq_weekly_player(target_session_id uuid, outgoing text, incoming text, expected_updated_at timestamptz, confirm_available boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare s tiq_league_weekly_sessions; plan jsonb; court jsonb; sets jsonb; matchup jsonb; next_roster jsonb;
begin
  select * into s from tiq_league_weekly_sessions where id = target_session_id for update;
  if s.id is null or auth.uid() is null or not can_manage_tiq_league(s.league_id) then raise exception 'Only League Office can replace players.'; end if;
  if s.updated_at is distinct from expected_updated_at then raise exception 'The week changed. Refresh before replacing a player.'; end if;
  if s.status <> 'published' then raise exception 'Publish courts before replacing a player.'; end if;
  if outgoing = incoming or not exists(select 1 from jsonb_array_elements(s.assignments) c where c->'players' ? outgoing)
     or exists(select 1 from jsonb_array_elements(s.assignments) c where c->'players' ? incoming) then raise exception 'Choose an assigned player and an unassigned substitute.'; end if;
  if not exists(select 1 from tiq_leagues l where l.id = s.league_id and incoming = any(l.players))
     or (not coalesce(confirm_available,false) and not exists(select 1 from tiq_league_weekly_responses r where r.session_id = s.id and r.player_name = incoming and r.response_status = 'in')) then raise exception 'Confirm that this league player is available before assigning a substitute.'; end if;
  plan := '[]'::jsonb;
  for court in select value from jsonb_array_elements(s.assignments) loop
    if court->'players' ? outgoing then
      court := jsonb_set(court, '{players}', (select jsonb_agg(case when value = outgoing then incoming else value end) from jsonb_array_elements_text(court->'players')));
      sets := '[]'::jsonb;
      for matchup in select value from jsonb_array_elements(court->'sets') loop
        matchup := jsonb_set(matchup, '{sideA}', (select jsonb_agg(case when value = outgoing then incoming else value end) from jsonb_array_elements_text(matchup->'sideA')));
        matchup := jsonb_set(matchup, '{sideB}', (select jsonb_agg(case when value = outgoing then incoming else value end) from jsonb_array_elements_text(matchup->'sideB')));
        sets := sets || jsonb_build_array(matchup);
      end loop;
      court := jsonb_set(court, '{sets}', sets);
    end if;
    plan := plan || jsonb_build_array(court);
  end loop;
  select jsonb_agg(value) into next_roster from (select distinct jsonb_array_elements_text(c->'players') value from jsonb_array_elements(plan) c) names;
  update tiq_league_weekly_sessions set assignments = plan, roster = next_roster where id = s.id;
  update tiq_league_weekly_change_requests set status = 'resolved' where session_id = s.id and player_name = outgoing;
  insert into tiq_league_weekly_responses(session_id,player_name,response_status) values(s.id,outgoing,'out')
    on conflict(session_id,player_name) do update set response_status = 'out', responded_at = now();
  insert into tiq_league_weekly_responses(session_id,player_name,response_status) values(s.id,incoming,'in')
    on conflict(session_id,player_name) do update set response_status = 'in', responded_at = now();
end $$;
revoke all on function public.replace_tiq_weekly_player(uuid,text,text,timestamptz,boolean) from public;
grant execute on function public.replace_tiq_weekly_player(uuid,text,text,timestamptz,boolean) to authenticated;
create function public.dismiss_tiq_weekly_withdrawal(target_session_id uuid, target_player text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists(select 1 from tiq_league_weekly_sessions s where s.id = target_session_id and can_manage_tiq_league(s.league_id)) then raise exception 'Only League Office can resolve withdrawal requests.'; end if;
  update tiq_league_weekly_change_requests set status = 'dismissed' where session_id = target_session_id and player_name = target_player and status = 'pending';
end $$;
revoke all on function public.dismiss_tiq_weekly_withdrawal(uuid,text) from public;
grant execute on function public.dismiss_tiq_weekly_withdrawal(uuid,text) to authenticated;
revoke all on function public.audit_weekly_plan_change(), public.audit_weekly_score_change(), public.guard_weekly_score_plan() from public;

create function public.approve_tiq_weekly_score(target_session_id uuid, target_court integer, target_set integer, games_a integer, games_b integer, correction_note text, expected_score jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s tiq_league_weekly_sessions; previous tiq_league_weekly_set_results; court jsonb; matchup jsonb;
begin
  select * into s from tiq_league_weekly_sessions where id = target_session_id for update;
  if s.id is null or auth.uid() is null or not can_manage_tiq_league(s.league_id) then raise exception 'Only League Office can approve scores.'; end if;
  if s.status not in ('published', 'completed') then raise exception 'Publish courts before approving scores.'; end if;
  select * into previous from tiq_league_weekly_set_results where session_id = s.id and court_number = target_court and set_number = target_set for update;
  if (case when previous.id is null then null else jsonb_build_object('sideAGames',previous.side_a_games,'sideBGames',previous.side_b_games,'reviewStatus',previous.review_status) end) is distinct from expected_score then raise exception 'This score changed. Refresh before approving it.'; end if;
  if games_a is null or games_b is null or not ((games_a = 6 and games_b between 0 and 4) or (games_b = 6 and games_a between 0 and 4) or (games_a = 7 and games_b in (5,6)) or (games_b = 7 and games_a in (5,6))) then raise exception 'Enter a completed set: 6 games by two, 7-5, or 7-6.'; end if;
  select value into court from jsonb_array_elements(s.assignments) where (value->>'courtNumber')::integer = target_court;
  select value into matchup from jsonb_array_elements(court->'sets') where (value->>'setNumber')::integer = target_set;
  if matchup is null then raise exception 'Choose a published set.'; end if;
  insert into tiq_league_weekly_set_results(session_id,court_number,set_number,side_a_players,side_b_players,side_a_games,side_b_games,submitted_by_name,submitted_at,review_status,approved_by_user_id,approved_at,review_note)
    values(s.id,target_court,target_set,array(select jsonb_array_elements_text(matchup->'sideA')),array(select jsonb_array_elements_text(matchup->'sideB')),games_a,games_b,'League review',now(),'approved',auth.uid(),now(),left(trim(coalesce(correction_note,'')),500))
    on conflict(session_id,court_number,set_number) do update set side_a_games = excluded.side_a_games,side_b_games = excluded.side_b_games,submitted_by_name = excluded.submitted_by_name,submitted_at = excluded.submitted_at,review_status = 'approved',approved_by_user_id = auth.uid(),approved_at = now(),review_note = excluded.review_note;
end $$;
revoke all on function public.approve_tiq_weekly_score(uuid,integer,integer,integer,integer,text,jsonb) from public;
grant execute on function public.approve_tiq_weekly_score(uuid,integer,integer,integer,integer,text,jsonb) to authenticated;
