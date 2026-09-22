-- Correct the legacy provisional cohort using only a stated source NTRP
-- designation. This deliberately excludes TennisRecord's estimated dynamic
-- rating and never overwrites a local, reviewed, or already-adjusted player.
with stated_ntrp as (
  select distinct on (source_player_key)
    source_player_key,
    ((regexp_match(trim(ntrp_label), '(^|\\s)([1-7]\\.[05])(\\s|$)'))[2])::numeric as baseline
  from public.tennisrecord_staged_players
  where trim(coalesce(ntrp_label, '')) ~ '(^|\\s)[1-7]\\.[05](\\s|$)'
  order by source_player_key, last_seen_at desc
)
update public.players as player
set
  rating_source = 'verified',
  singles_rating = stated_ntrp.baseline,
  doubles_rating = stated_ntrp.baseline,
  overall_rating = stated_ntrp.baseline
from stated_ntrp
where player.external_source = 'tennisrecord'
  and player.is_external_provisional = true
  and player.external_source_key = stated_ntrp.source_player_key
  and player.rating_source = 'self'
  and coalesce(player.overall_rating, 3.5) = 3.5
  and coalesce(player.singles_rating, 3.5) = 3.5
  and coalesce(player.doubles_rating, 3.5) = 3.5;
