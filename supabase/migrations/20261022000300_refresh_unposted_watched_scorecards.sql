-- A successfully captured, structurally identified scorecard awaiting source
-- publication is refresh work. Identity and access holds remain terminal.
create function public.release_tennisrecord_unposted_scorecard(p_source_url text,p_page_id uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare captured timestamptz; affected integer;
begin
  select captured_at into captured from public.tennisrecord_source_pages
    where id=p_page_id and source_url=p_source_url and not blocked and http_status between 200 and 299;
  if captured is null then raise exception 'A successful retained capture is required'; end if;
  -- The service parser requires two same-season teams, one same-season league,
  -- a valid past scheduled date, no reviewReason, no printed winner and no courts.
  -- Bind the classification to the observation saved by that parser first.
  update public.tennisrecord_crawl_queue q set status='done',
    failure_reason='Awaiting published source results; normal weekly refresh is scheduled.',
    refresh_season=extract(year from now() at time zone 'UTC')::integer,
    refresh_due_at=greatest(captured+interval '7 days',now()+interval '1 hour')
    where q.source_url=p_source_url and q.status='review'
      and q.failure_reason='No complete TennisRecord court results were parsed; page evidence was retained for review.'
      and exists(select 1 from public.tennisrecord_league_watch_pages p
        join public.tennisrecord_league_watches w on w.source_url=p.league_url and w.enabled
        where p.source_url=q.source_url and p.page_kind='match' and p.results_pending and p.observed_at=captured);
  get diagnostics affected=row_count;
  return affected;
end $$;
revoke all on function public.release_tennisrecord_unposted_scorecard(text,uuid) from public,anon,authenticated;
grant execute on function public.release_tennisrecord_unposted_scorecard(text,uuid) to service_role;
