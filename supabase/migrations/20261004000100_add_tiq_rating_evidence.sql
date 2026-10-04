-- Publication evidence: never overload the official USTA source designation.
alter table public.players
  add column if not exists tiq_rating_status text check (tiq_rating_status in ('current','provisional','review')),
  add column if not exists tiq_rating_model text,
  add column if not exists tiq_rating_season integer,
  add column if not exists tiq_singles_matches integer check (tiq_singles_matches >= 0),
  add column if not exists tiq_doubles_matches integer check (tiq_doubles_matches >= 0);
