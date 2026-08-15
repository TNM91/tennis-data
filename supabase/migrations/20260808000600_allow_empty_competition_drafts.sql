alter table public.tiq_leagues
  drop constraint if exists tiq_leagues_team_vs_individual_check;
alter table public.tiq_leagues
  add constraint tiq_leagues_team_vs_individual_check check (
    season_status = 'draft'
    or (league_format = 'team' and cardinality(teams) >= 1)
    or (league_format = 'individual' and cardinality(players) >= 1)
  );
alter table public.tiq_tournaments
  drop constraint if exists tiq_tournaments_entrants_check;
alter table public.tiq_tournaments
  add constraint tiq_tournaments_entrants_check check (
    status = 'draft' or cardinality(entrants) >= 2
  );
comment on constraint tiq_leagues_team_vs_individual_check on public.tiq_leagues is
  'Draft league shells may start empty; published seasons require the correct participant type.';
comment on constraint tiq_tournaments_entrants_check on public.tiq_tournaments is
  'Draft tournament shells may start empty; open and scheduled tournaments require at least two entrants.';
