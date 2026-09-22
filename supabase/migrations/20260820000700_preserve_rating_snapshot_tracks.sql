-- TiQ and USTA-proximity snapshots are distinct histories for the same match.
-- Keep both, rather than allowing one track to overwrite the other.
drop index if exists public.rating_snapshots_unique_player_match_type_idx;

create unique index if not exists rating_snapshots_unique_player_match_type_track_idx
  on public.rating_snapshots (player_id, match_id, rating_type, track);
