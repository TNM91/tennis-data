drop index if exists public.rating_snapshots_unique_player_match_type_idx;

with ranked_snapshots as (
  select
    id,
    row_number() over (
      partition by player_id, match_id, rating_type, track
      order by snapshot_date desc, id desc
    ) as duplicate_rank
  from public.rating_snapshots
)
delete from public.rating_snapshots
using ranked_snapshots
where public.rating_snapshots.id = ranked_snapshots.id
  and ranked_snapshots.duplicate_rank > 1;

create unique index if not exists rating_snapshots_unique_player_match_type_track_idx
  on public.rating_snapshots (player_id, match_id, rating_type, track);
