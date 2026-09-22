drop policy if exists "Club staff can read team league entries" on public.tiq_team_league_entries;
create policy "Club staff can read team league entries"
on public.tiq_team_league_entries
for select to authenticated
using (
  exists (
    select 1 from public.tiq_leagues league
    where league.id = league_id
      and league.club_id is not null
      and league.league_format = 'team'
      and public.can_run_club_competition(league.club_id)
  )
);

drop policy if exists "Club staff can add team league entries" on public.tiq_team_league_entries;
create policy "Club staff can add team league entries"
on public.tiq_team_league_entries
for insert to authenticated
with check (
  entry_status = 'active'
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and exists (
    select 1 from public.tiq_leagues league
    where league.id = league_id
      and league.club_id is not null
      and league.league_format = 'team'
      and public.can_run_club_competition(league.club_id)
  )
);

drop policy if exists "Club staff can update team league entries" on public.tiq_team_league_entries;
create policy "Club staff can update team league entries"
on public.tiq_team_league_entries
for update to authenticated
using (
  exists (
    select 1 from public.tiq_leagues league
    where league.id = league_id
      and league.club_id is not null
      and league.league_format = 'team'
      and public.can_run_club_competition(league.club_id)
  )
)
with check (
  entry_status = 'active'
  and updated_by_user_id = auth.uid()
  and exists (
    select 1 from public.tiq_leagues league
    where league.id = league_id
      and league.club_id is not null
      and league.league_format = 'team'
      and public.can_run_club_competition(league.club_id)
  )
);
