-- Foreign-key lookups when removing proven synthetic observations must not
-- rescan the entire history once per observation. No data is changed.
create index if not exists tennisrecord_canonical_winning_observation_idx
  on public.tennisrecord_canonical_matches(winning_observation_id);
create index if not exists tennisrecord_observation_superseded_by_idx
  on public.tennisrecord_match_observations(superseded_by);
