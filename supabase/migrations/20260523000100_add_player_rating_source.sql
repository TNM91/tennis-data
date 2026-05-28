alter table public.players
  add column if not exists rating_source text not null default 'verified';

alter table public.players
  drop constraint if exists players_rating_source_check;

alter table public.players
  add constraint players_rating_source_check
  check (rating_source in ('verified', 'self'));

create index if not exists players_rating_source_idx on public.players (rating_source);
