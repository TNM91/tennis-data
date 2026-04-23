alter table public.tiq_leagues
add column if not exists individual_competition_format text not null default 'standard';

alter table public.tiq_leagues
drop constraint if exists tiq_leagues_individual_competition_format_check;

alter table public.tiq_leagues
add constraint tiq_leagues_individual_competition_format_check
check (individual_competition_format in ('standard', 'ladder', 'round_robin', 'challenge'));
