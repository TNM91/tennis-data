alter table public.tiq_leagues
  add column if not exists club_group_id uuid references public.club_groups(id) on delete set null;
alter table public.tiq_tournaments
  add column if not exists club_group_id uuid references public.club_groups(id) on delete set null;
create unique index if not exists tiq_leagues_club_group_unique
  on public.tiq_leagues (club_group_id)
  where club_group_id is not null;
create unique index if not exists tiq_tournaments_club_group_unique
  on public.tiq_tournaments (club_group_id)
  where club_group_id is not null;
comment on column public.tiq_leagues.club_group_id is
  'Direct link from a Club league-division program to its TIQ league.';
comment on column public.tiq_tournaments.club_group_id is
  'Direct link from a Club tournament-field program to its TIQ tournament.';
