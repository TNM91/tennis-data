alter table public.tiq_leagues
  add column if not exists result_mode text not null default 'tiq_rated';

alter table public.tiq_leagues
  drop constraint if exists tiq_leagues_result_mode_check;

alter table public.tiq_leagues
  add constraint tiq_leagues_result_mode_check
  check (result_mode in ('tiq_rated', 'public_history', 'social'));

alter table public.tiq_tournaments
  add column if not exists result_mode text not null default 'tiq_rated';

alter table public.tiq_tournaments
  drop constraint if exists tiq_tournaments_result_mode_check;

alter table public.tiq_tournaments
  add constraint tiq_tournaments_result_mode_check
  check (result_mode in ('tiq_rated', 'public_history', 'social'));

alter table public.matches
  add column if not exists club_id uuid references public.clubs(id) on delete set null,
  add column if not exists rating_eligible boolean not null default true,
  add column if not exists public_history_eligible boolean not null default true,
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id text;

alter table public.matches
  drop constraint if exists matches_source_entity_type_check;

alter table public.matches
  add constraint matches_source_entity_type_check
  check (source_entity_type is null or source_entity_type in ('league', 'tournament'));

alter table public.matches
  drop constraint if exists matches_match_source_check;

alter table public.matches
  add constraint matches_match_source_check
  check (match_source in ('usta', 'tiq_team', 'tiq_individual', 'tiq_tournament'));

create index if not exists matches_public_history_idx
  on public.matches (public_history_eligible, match_date desc);

create index if not exists matches_rating_eligible_idx
  on public.matches (rating_eligible, match_date asc);

create index if not exists matches_club_idx
  on public.matches (club_id, match_date desc)
  where club_id is not null;

comment on column public.tiq_leagues.result_mode is
  'Controls whether results update TIQ ratings, appear only in public history, or remain social/local to the event.';

comment on column public.tiq_tournaments.result_mode is
  'Controls whether results update TIQ ratings, appear only in public history, or remain social/local to the event.';

comment on column public.matches.rating_eligible is
  'False when a result should remain visible without changing TIQ ratings.';

comment on column public.matches.public_history_eligible is
  'False when a social/local result should stay out of public player history.';
