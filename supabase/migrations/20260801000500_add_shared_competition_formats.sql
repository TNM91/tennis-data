alter table if exists public.tiq_leagues
add column if not exists team_match_format_id text not null default 'standard_2s_3d';
alter table if exists public.tiq_leagues
drop constraint if exists tiq_leagues_team_match_format_id_check;
alter table if exists public.tiq_leagues
add constraint tiq_leagues_team_match_format_id_check
check (
  team_match_format_id in (
    'standard_2s_3d',
    'adult_18_1s_2d',
    'adult_40_1s_4d',
    'adult_40_1s_3d',
    'three_doubles',
    'four_doubles',
    'tri_level',
    'mixed_tri_level',
    'dominant_duo',
    'one_singles',
    'two_singles',
    'three_singles',
    'four_singles',
    'one_doubles',
    'two_doubles',
    'custom'
  )
);
alter table if exists public.tiq_tournaments
drop constraint if exists tiq_tournaments_format_check;
alter table if exists public.tiq_tournaments
add constraint tiq_tournaments_format_check
check (
  format in (
    'single_elimination',
    'round_robin',
    'round_robin_first_match_consolation',
    'modified_feed_in_consolation',
    'compass_draw',
    'voluntary_consolation',
    'first_match_consolation',
    'team_tournament',
    'feed_in_consolation',
    'curtis_consolation',
    'flighted_draw'
  )
);
