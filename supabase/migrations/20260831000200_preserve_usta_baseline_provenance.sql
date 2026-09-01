-- Keep an unverified TennisRecord participant distinct from an explicitly
-- self-rated USTA player. A missing profile label is not evidence of a 3.5
-- self-rating. The rating engine can then use a measured provisional path
-- while the collector fetches the exact public profile URL.
begin;

alter table public.players
  drop constraint if exists players_rating_source_check;

alter table public.players
  add constraint players_rating_source_check
  check (rating_source in ('verified', 'inferred', 'self', 'unknown'));

-- Existing TennisRecord-created players without a factual NTRP observation
-- were historically labelled `self` because the collector only had a match
-- participant. Preserve a true `S`; reclassify only records with no stated
-- NTRP evidence at all. Local, captain, and admin-managed records are never
-- changed.
update public.players as player
set rating_source = 'unknown'
where player.external_source = 'tennisrecord'
  and player.is_external_provisional is true
  and player.rating_source = 'self'
  and not exists (
    select 1
    from public.tennisrecord_ntrp_observations observation
    where observation.canonical_player_id = player.id
      and observation.ntrp is not null
  );

-- Schedule one controlled native TiQ rebuild after the new source taxonomy
-- is live. It uses only canonical match results and TiQ's own model.
update public.tennisrecord_collector_settings
set
  rating_recalculation_requested_at = timezone('utc', now()),
  rating_recalculation_reason = 'preserve_usta_baseline_provenance'
where id = true;

commit;
