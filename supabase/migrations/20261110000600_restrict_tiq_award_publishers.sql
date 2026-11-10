begin;
set local lock_timeout = '5s';

drop policy "Authenticated users can create TIQ awards" on public.tiq_awards;
create policy "Competition managers can create TIQ awards" on public.tiq_awards
for insert to authenticated with check (
  created_by_user_id = (select auth.uid()) and (
    (source_type = 'league' and public.can_manage_tiq_league(source_id))
    or (source_type = 'tournament' and public.can_manage_tiq_tournament(source_id)
      and exists (select 1 from public.tiq_tournaments t where t.id = tiq_awards.source_id and not t.is_event))
  )
);

drop policy "Creators can update TIQ awards" on public.tiq_awards;
create policy "Competition managers can update their TIQ awards" on public.tiq_awards
for update to authenticated using (
  created_by_user_id = (select auth.uid()) and (
    (source_type = 'league' and public.can_manage_tiq_league(source_id))
    or (source_type = 'tournament' and public.can_manage_tiq_tournament(source_id))
  )
) with check (
  created_by_user_id = (select auth.uid()) and (
    (source_type = 'league' and public.can_manage_tiq_league(source_id))
    or (source_type = 'tournament' and public.can_manage_tiq_tournament(source_id)
      and exists (select 1 from public.tiq_tournaments t where t.id = tiq_awards.source_id and not t.is_event))
  )
);

commit;
