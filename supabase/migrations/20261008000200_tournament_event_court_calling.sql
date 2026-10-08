begin;
create table public.tiq_event_court_statuses (
 event_id text not null references public.tiq_tournaments(id) on delete cascade,
 tournament_id text not null references public.tiq_tournaments(id) on delete cascade,
 match_id text not null check(length(match_id) between 1 and 120),
 status text not null check(status in ('queued','called','on_court')),
 side_a text not null, side_b text not null, slot text not null,
 court_key text not null,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(tournament_id,match_id)
);
alter table public.tiq_event_court_statuses enable row level security;
revoke all on public.tiq_event_court_statuses from anon,authenticated;
grant select on public.tiq_event_court_statuses to authenticated;
grant all on public.tiq_event_court_statuses to service_role;
create policy "Managers read court calls" on public.tiq_event_court_statuses for select to authenticated
 using(public.can_manage_tiq_tournament(event_id) and public.can_manage_tiq_tournament(tournament_id));
create function public.save_tiq_event_court_status(target_event text,target_division text,target_match text,next_status text,player_a text,player_b text,expected_slot text,expected_version timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 division public.tiq_tournaments%rowtype;
 previous public.tiq_event_court_statuses%rowtype;
 saved public.tiq_event_court_statuses%rowtype;
 schedule jsonb; slot_value text; normalized_court text;
begin
 if auth.uid() is null or not public.can_manage_tiq_tournament(target_event) then raise exception 'Organizer access required.'; end if;
 perform 1 from public.tiq_tournaments where id=target_event and is_event and status<>'completed' for update;
 if not found then raise exception 'Choose an active event.'; end if;
 select * into division from public.tiq_tournaments where id=target_division and event_id=target_event and status<>'completed' for update;
 if not found or not public.can_manage_tiq_tournament(target_division) then raise exception 'Choose a division in this event.'; end if;
 if next_status is null or next_status not in ('queued','called','on_court') or length(target_match) not between 1 and 120 then raise exception 'Invalid court status.'; end if;
 select * into previous from public.tiq_event_court_statuses where tournament_id=target_division and match_id=target_match for update;
 if previous.updated_at is distinct from expected_version then raise exception 'Court status changed. Refresh before saving.'; end if;
 if next_status<>'queued' then
  schedule:=division.schedule->target_match;
  slot_value:=coalesce(schedule->>'date','')||'|'||coalesce(schedule->>'time','')||'|'||coalesce(schedule->>'court','');
  if schedule is null or coalesce(schedule->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(schedule->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or btrim(coalesce(schedule->>'court',''))='' or slot_value is distinct from expected_slot then raise exception 'Court assignment changed. Refresh before calling.'; end if;
  if player_a is null or player_b is null or player_a=player_b or not player_a=any(division.entrants) or not player_b=any(division.entrants) or coalesce(division.results->target_match->>'winner','')<>'' then raise exception 'Choose an unfinished match with confirmed players.'; end if;
  if (select count(*) from public.tiq_tournament_arrivals where tournament_id=target_division and entrant_name in (player_a,player_b) and checked_in)<>2 then raise exception 'Check in both entrants before calling the match.'; end if;
  normalized_court:=regexp_replace(lower(btrim(schedule->>'court')),'^court[[:space:]]+','');
  normalized_court:=regexp_replace(normalized_court,'[[:space:]]+',' ','g');
  if normalized_court ~ '^[0-9]+$' then normalized_court:=coalesce(nullif(ltrim(normalized_court,'0'),''),'0'); end if;
  if next_status='on_court' and (previous.status is distinct from 'called' or previous.side_a is distinct from player_a or previous.side_b is distinct from player_b or previous.slot is distinct from expected_slot) then raise exception 'Call this match before marking it on court.'; end if;
  if exists(select 1 from public.tiq_event_court_statuses s join public.tiq_tournaments t on t.id=s.tournament_id where s.event_id=target_event and s.status in ('called','on_court') and (s.tournament_id,s.match_id)<>(target_division,target_match) and coalesce(t.results->s.match_id->>'winner','')='' and s.slot=coalesce(t.schedule->s.match_id->>'date','')||'|'||coalesce(t.schedule->s.match_id->>'time','')||'|'||coalesce(t.schedule->s.match_id->>'court','') and (s.court_key=normalized_court or s.side_a in (player_a,player_b) or s.side_b in (player_a,player_b))) then raise exception 'A court or entrant is already called or on court. Finish or undo that call first.'; end if;
 else
  normalized_court:=coalesce(previous.court_key,'');
 end if;
 insert into public.tiq_event_court_statuses(event_id,tournament_id,match_id,status,side_a,side_b,slot,court_key)
 values(target_event,target_division,target_match,next_status,player_a,player_b,expected_slot,normalized_court)
 on conflict(tournament_id,match_id) do update set status=excluded.status,side_a=excluded.side_a,side_b=excluded.side_b,slot=excluded.slot,court_key=excluded.court_key,updated_at=clock_timestamp()
 returning * into saved;
 return to_jsonb(saved);
end;
$$;
revoke all on function public.save_tiq_event_court_status(text,text,text,text,text,text,text,timestamptz) from public,anon;
grant execute on function public.save_tiq_event_court_status(text,text,text,text,text,text,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
