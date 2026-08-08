drop policy if exists "Club staff can read player league entries" on public.tiq_player_league_entries;
create policy "Club staff can read player league entries"
on public.tiq_player_league_entries
for select to authenticated
using (
  exists (
    select 1 from public.tiq_leagues league
    where league.id = league_id
      and league.club_id is not null
      and league.league_format = 'individual'
      and public.can_run_club_competition(league.club_id)
  )
);

drop policy if exists "Club staff can add player league entries" on public.tiq_player_league_entries;
create policy "Club staff can add player league entries"
on public.tiq_player_league_entries
for insert to authenticated
with check (
  entry_status = 'active'
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and exists (
    select 1 from public.tiq_leagues league
    where league.id = league_id
      and league.club_id is not null
      and league.league_format = 'individual'
      and public.can_run_club_competition(league.club_id)
  )
);

drop policy if exists "Club staff can update player league entries" on public.tiq_player_league_entries;
create policy "Club staff can update player league entries"
on public.tiq_player_league_entries
for update to authenticated
using (
  exists (
    select 1 from public.tiq_leagues league
    where league.id = league_id
      and league.club_id is not null
      and league.league_format = 'individual'
      and public.can_run_club_competition(league.club_id)
  )
)
with check (
  entry_status in ('active', 'removed')
  and updated_by_user_id = auth.uid()
  and exists (
    select 1 from public.tiq_leagues league
    where league.id = league_id
      and league.club_id is not null
      and league.league_format = 'individual'
      and public.can_run_club_competition(league.club_id)
  )
);

drop policy if exists "Club staff can read tournament entries" on public.tiq_tournament_entries;
create policy "Club staff can read tournament entries"
on public.tiq_tournament_entries
for select to authenticated
using (
  exists (
    select 1 from public.tiq_tournaments tournament
    where tournament.id = tournament_id
      and tournament.club_id is not null
      and tournament.entrant_type = 'players'
      and public.can_run_club_competition(tournament.club_id)
  )
);

drop policy if exists "Club staff can add approved tournament entries" on public.tiq_tournament_entries;
create policy "Club staff can add approved tournament entries"
on public.tiq_tournament_entries
for insert to authenticated
with check (
  status = 'approved'
  and exists (
    select 1 from public.tiq_tournaments tournament
    where tournament.id = tournament_id
      and tournament.club_id is not null
      and tournament.entrant_type = 'players'
      and public.can_run_club_competition(tournament.club_id)
  )
);

drop policy if exists "Club staff can update tournament entries" on public.tiq_tournament_entries;
create policy "Club staff can update tournament entries"
on public.tiq_tournament_entries
for update to authenticated
using (
  exists (
    select 1 from public.tiq_tournaments tournament
    where tournament.id = tournament_id
      and tournament.club_id is not null
      and tournament.entrant_type = 'players'
      and public.can_run_club_competition(tournament.club_id)
  )
)
with check (
  status in ('approved', 'declined')
  and exists (
    select 1 from public.tiq_tournaments tournament
    where tournament.id = tournament_id
      and tournament.club_id is not null
      and tournament.entrant_type = 'players'
      and public.can_run_club_competition(tournament.club_id)
  )
);

comment on table public.tiq_player_league_entries is
  'Player entries, including direct placements by authorized staff for a linked Club individual league.';

comment on table public.tiq_tournament_entries is
  'Tournament entries, including direct approved placements by authorized staff for a linked Club player tournament.';
