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
commit;
