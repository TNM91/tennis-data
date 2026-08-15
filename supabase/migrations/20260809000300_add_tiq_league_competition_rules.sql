alter table if exists public.tiq_leagues
add column if not exists competition_rules jsonb not null default '{}'::jsonb;
alter table if exists public.tiq_leagues
drop constraint if exists tiq_leagues_competition_rules_object_check;
alter table if exists public.tiq_leagues
add constraint tiq_leagues_competition_rules_object_check
check (jsonb_typeof(competition_rules) = 'object');
comment on column public.tiq_leagues.competition_rules is
'Optional normalized eligibility, partner, level, standings, and local rule overrides shared by League Office, Captain, clubs, and standings.';
