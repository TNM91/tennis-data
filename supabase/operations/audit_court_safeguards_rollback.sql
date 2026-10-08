begin;
-- Schedule updates and court calls both lock the division row. This trigger therefore
-- checks the committed call status after a competing call transaction finishes.
create function public.guard_tiq_event_active_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.event_id is null or new.schedule is not distinct from old.schedule then return new; end if;
 if exists (
  select 1 from public.tiq_event_court_statuses s
  where s.tournament_id=old.id and s.event_id=old.event_id
   and s.status in ('called','on_court')
   and coalesce(old.results->s.match_id->>'winner','')=''
   and s.slot=coalesce(old.schedule->s.match_id->>'date','')||'|'||coalesce(old.schedule->s.match_id->>'time','')||'|'||coalesce(old.schedule->s.match_id->>'court','')
   and (coalesce(new.schedule->s.match_id->>'date','') is distinct from coalesce(old.schedule->s.match_id->>'date','')
     or coalesce(new.schedule->s.match_id->>'time','') is distinct from coalesce(old.schedule->s.match_id->>'time','')
     or coalesce(new.schedule->s.match_id->>'court','') is distinct from coalesce(old.schedule->s.match_id->>'court',''))
 ) then raise exception 'This match is called or on court. Undo the call in Next on court before changing its assignment.'; end if;
 return new;
end;
$$;
revoke all on function public.guard_tiq_event_active_assignment() from public,anon,authenticated;
create trigger guard_tiq_event_active_assignment before update of schedule on public.tiq_tournaments
 for each row execute function public.guard_tiq_event_active_assignment();
notify pgrst,'reload schema';


do $$
declare version timestamptz; rejected boolean; action text;
begin
 perform set_config('request.jwt.claim.sub','accc3471-8912-491c-b8d9-4a84dcc7c42e',true);
 update public.tiq_tournaments set entrants=array['Audit A','Audit B'], results='{}'::jsonb,
 schedule='{"audit-lock":{"date":"2026-10-17","time":"17:30","court":"1"},"audit-other":{"date":"2026-10-17","time":"18:30","court":"2"}}'::jsonb
 where id='pumpkin-playoffs-2026-mens-4-0-doubles';
 insert into public.tiq_tournament_arrivals(tournament_id,entrant_name,checked_in)
 values ('pumpkin-playoffs-2026-mens-4-0-doubles','Audit A',true),('pumpkin-playoffs-2026-mens-4-0-doubles','Audit B',true);
 execute 'set local role authenticated';
 version:=(public.save_tiq_event_court_status('pumpkin-playoffs-2026','pumpkin-playoffs-2026-mens-4-0-doubles','audit-lock','called','Audit A','Audit B','2026-10-17|17:30|1',null)->>'updated_at')::timestamptz;
 foreach action in array array['court','time','date','clear'] loop
  rejected:=false;
  begin
   if action='clear' then
    update public.tiq_tournaments set schedule=schedule-'audit-lock' where id='pumpkin-playoffs-2026-mens-4-0-doubles';
   else
    update public.tiq_tournaments set schedule=jsonb_set(schedule,array['audit-lock',action],to_jsonb(case action when 'court' then '3' when 'time' then '19:00' else '2026-10-18' end)) where id='pumpkin-playoffs-2026-mens-4-0-doubles';
   end if;
  exception when others then
   if sqlerrm<>'This match is called or on court. Undo the call in Next on court before changing its assignment.' then raise; end if;
   rejected:=true;
  end;
  if not rejected then raise exception 'Missing active assignment guard: %',action; end if;
 end loop;
 -- Same slot metadata and another match remain editable.
 update public.tiq_tournaments set schedule=jsonb_set(schedule,'{audit-lock,updatedAt}','"2026-10-08T00:00:00Z"') where id='pumpkin-playoffs-2026-mens-4-0-doubles';
 update public.tiq_tournaments set schedule=jsonb_set(schedule,'{audit-other,court}','"3"') where id='pumpkin-playoffs-2026-mens-4-0-doubles';
 version:=(public.save_tiq_event_court_status('pumpkin-playoffs-2026','pumpkin-playoffs-2026-mens-4-0-doubles','audit-lock','on_court','Audit A','Audit B','2026-10-17|17:30|1',version)->>'updated_at')::timestamptz;
 rejected:=false;
 begin
  update public.tiq_tournaments set schedule=jsonb_set(schedule,'{audit-lock,court}','"4"') where id='pumpkin-playoffs-2026-mens-4-0-doubles';
 exception when others then
  if sqlerrm<>'This match is called or on court. Undo the call in Next on court before changing its assignment.' then raise; end if;
  rejected:=true;
 end;
 if not rejected then raise exception 'Missing on-court guard'; end if;
 version:=(public.save_tiq_event_court_status('pumpkin-playoffs-2026','pumpkin-playoffs-2026-mens-4-0-doubles','audit-lock','queued','Audit A','Audit B','2026-10-17|17:30|1',version)->>'updated_at')::timestamptz;
 update public.tiq_tournaments set schedule=jsonb_set(schedule,'{audit-lock,court}','"4"') where id='pumpkin-playoffs-2026-mens-4-0-doubles';
 version:=(public.save_tiq_event_court_status('pumpkin-playoffs-2026','pumpkin-playoffs-2026-mens-4-0-doubles','audit-lock','called','Audit A','Audit B','2026-10-17|17:30|4',version)->>'updated_at')::timestamptz;
 -- Posting a result releases the assignment without an extra undo action.
 update public.tiq_tournaments set results='{"audit-lock":{"winner":"Audit A","score":"6-4"}}'::jsonb where id='pumpkin-playoffs-2026-mens-4-0-doubles';
 update public.tiq_tournaments set schedule=jsonb_set(schedule,'{audit-lock,court}','"5"') where id='pumpkin-playoffs-2026-mens-4-0-doubles';
 execute 'reset role';
 if has_function_privilege('authenticated','public.guard_tiq_event_active_assignment()','EXECUTE') or has_function_privilege('anon','public.guard_tiq_event_active_assignment()','EXECUTE') then raise exception 'Unexpected direct function privilege'; end if;
 raise notice 'Called/on-court schedule locks, undo recovery, unrelated edits, and completed results passed. All fixtures roll back.';
end $$;
rollback;
