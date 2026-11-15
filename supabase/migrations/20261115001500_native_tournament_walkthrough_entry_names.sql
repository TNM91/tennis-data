begin;
set local lock_timeout = '5s';

-- Keep private rehearsals out of discovery. Resolve names only for the invited
-- account's own saved entries, using the same access check as the event link.
create function public.native_tournament_walkthrough_entry_names(p_divisions text[])
returns jsonb language sql stable security definer set search_path = ''
set statement_timeout = '5s' as $$
  with viewer as (select auth.uid() as id),
  authorized as materialized (
    select private.native_tournament_walkthrough(d.event_id,d.id,v.id) as rehearsal
    from viewer v
    join private.active_native_tournament_rehearsals w on w.winner_id=v.id and w.walkthrough_enabled
    join public.tiq_tournaments d on d.event_id=w.event_key and d.id=any(p_divisions)
    where cardinality(p_divisions) between 1 and 30 and exists (
      select 1 from public.tiq_tournament_entries e
      where e.tournament_id=d.id and e.submitted_by_user_id=v.id
        and e.status in ('pending','approved','declined') and e.native_registration->>'version'='1'
    )
  )
  select jsonb_build_object('owner',(select id from viewer),'entries',coalesce((
    select jsonb_agg(jsonb_build_object(
      'parent',rehearsal #>> '{root,id}', 'division',rehearsal #>> '{division,id}',
      'eventName',rehearsal #>> '{root,name}', 'divisionName',rehearsal #>> '{division,name}'
    )) from authorized where rehearsal is not null
  ),'[]'::jsonb));
$$;
revoke all on function public.native_tournament_walkthrough_entry_names(text[]) from public,anon,authenticated,service_role;
grant execute on function public.native_tournament_walkthrough_entry_names(text[]) to authenticated;

notify pgrst,'reload schema';
commit;
