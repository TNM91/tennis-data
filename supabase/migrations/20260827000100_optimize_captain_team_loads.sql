-- Keep captain Teams and Lineup Builder reads fast as imported match history grows.
-- Each index mirrors an existing production request filter and avoids broad scans.

create index if not exists team_profile_links_profile_team_status_idx
  on public.team_profile_links (profile_user_id, normalized_team_name, status);

create index if not exists matches_home_team_schedule_lookup_idx
  on public.matches (home_team, match_date desc)
  where line_number is null;

create index if not exists matches_away_team_schedule_lookup_idx
  on public.matches (away_team, match_date desc)
  where line_number is null;

create index if not exists lineup_availability_team_date_lookup_idx
  on public.lineup_availability (team_name, match_date desc);
