-- The prior designation migration used a regex escape sequence that is not
-- portable across Postgres string settings. Use the POSIX whitespace class so
-- every factual self-rating label (for example, "4.0 S") is classified
-- consistently. This is intentionally limited to source-isolated records.
update public.players as player
set rating_source = 'self'
from public.tennisrecord_staged_players as staged
where player.external_source = 'tennisrecord'
  and player.is_external_provisional is true
  and player.external_source_key = staged.source_player_key
  and staged.ntrp_label ~* '(^|[[:space:]])[1-7][.][05][[:space:]]*S([[:space:]]|$)'
  and player.rating_source <> 'self';
