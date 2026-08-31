-- A public match flight is not an official C/S designation: players can play
-- up, and Mixed/Tri-Level divisions intentionally combine levels.  It is,
-- however, strong enough to replace the artificial 3.5 provisional baseline
-- when a TennisRecord-created player has sustained, dominant participation in
-- one current standard Adult flight.  Explicit source designations and all
-- local/captain/admin records remain higher authority and are untouched.
begin;

alter table public.players
  drop constraint if exists players_rating_source_check;

alter table public.players
  add constraint players_rating_source_check
  check (rating_source in ('verified', 'inferred', 'self'));

-- Inferred rating evidence can also move through the existing tournament and
-- league eligibility review paths. It stays reviewable there; only an
-- explicit official designation is treated as verified.
alter table public.team_roster_members
  drop constraint if exists team_roster_members_rating_source_check;

alter table public.team_roster_members
  add constraint team_roster_members_rating_source_check
  check (rating_source in ('verified', 'inferred', 'self', 'unknown'));

alter table public.tiq_tournament_entries
  drop constraint if exists tiq_tournament_entries_eligibility_evidence_source_check;

alter table public.tiq_tournament_entries
  add constraint tiq_tournament_entries_eligibility_evidence_source_check
  check (
    eligibility_rating_source in ('verified', 'inferred', 'self', 'unknown')
    and eligibility_mixed_pair_role_source in ('verified', 'self', 'unknown')
    and eligibility_age_division_source in ('verified', 'self', 'unknown')
    and eligibility_mixed_pair_role in ('man', 'woman', 'unknown')
  );

alter table public.tiq_player_league_entries
  drop constraint if exists tiq_player_league_entries_eligibility_evidence_source_check;

alter table public.tiq_player_league_entries
  add constraint tiq_player_league_entries_eligibility_evidence_source_check
  check (
    eligibility_rating_source in ('verified', 'inferred', 'self', 'unknown')
    and eligibility_mixed_pair_role_source in ('verified', 'self', 'unknown')
    and eligibility_age_division_source in ('verified', 'self', 'unknown')
    and eligibility_mixed_pair_role in ('man', 'woman', 'unknown')
  );

-- A profile may state a factual numeric USTA level but omit the C/S suffix.
-- Preserve the level and mark its source correctly as inferred; do not claim
-- that it was self-rated. Explicit C and explicit S observations are left as
-- they are, and locally managed players are never touched.
with stated_level_without_designation as (
  select distinct on (observation.canonical_player_id)
    observation.canonical_player_id,
    observation.ntrp
  from public.tennisrecord_ntrp_observations observation
  where observation.canonical_player_id is not null
    and observation.ntrp is not null
    and observation.designation = 'unknown'
  order by observation.canonical_player_id,
    observation.effective_date desc nulls last,
    observation.observed_at desc,
    observation.last_seen_at desc
)
update public.players as player
set
  rating_source = 'inferred',
  singles_rating = stated.ntrp,
  doubles_rating = stated.ntrp,
  overall_rating = stated.ntrp
from stated_level_without_designation stated
where player.id = stated.canonical_player_id
  and player.external_source = 'tennisrecord'
  and player.is_external_provisional is true
  and player.rating_source = 'self';

with standard_adult_matches as (
  select
    mp.player_id,
    extract(year from m.match_date)::integer as season_year,
    coalesce(
      (regexp_match(trim(coalesce(m.flight, '')), '^([2-5][.][05])$'))[1],
      (regexp_match(coalesce(m.league_name, ''), '(^|[^0-9])([2-5][.][05])([^0-9]|$)'))[2]
    )::numeric as ntrp
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  where m.rating_eligible is true
    and coalesce(m.match_source, 'usta') = 'usta'
    and lower(coalesce(m.league_name, '')) ~ '(^|[^a-z])adult([^a-z]|$)'
    and lower(coalesce(m.league_name, '')) !~ '(mixed|tri[- ]?level)'
),
current_season as (
  select player_id, max(season_year) as season_year
  from standard_adult_matches
  where ntrp is not null
  group by player_id
),
season_matches as (
  select evidence.player_id, evidence.season_year, evidence.ntrp
  from standard_adult_matches evidence
  join current_season current
    on current.player_id = evidence.player_id
   and current.season_year = evidence.season_year
  where evidence.ntrp is not null
),
season_totals as (
  select player_id, season_year, count(*) as season_matches
  from season_matches
  group by player_id, season_year
),
level_counts as (
  select player_id, season_year, ntrp, count(*) as evidence_matches
  from season_matches
  group by player_id, season_year, ntrp
),
dominant_levels as (
  select
    counts.*,
    totals.season_matches,
    row_number() over (
      partition by counts.player_id
      order by counts.evidence_matches desc, counts.ntrp desc
    ) as level_rank
  from level_counts counts
  join season_totals totals
    on totals.player_id = counts.player_id
   and totals.season_year = counts.season_year
),
inferred_baselines as (
  select player_id, ntrp
  from dominant_levels
  where level_rank = 1
    and evidence_matches >= 8
    and evidence_matches::numeric / nullif(season_matches, 0) >= 0.70
)
update public.players as player
set
  rating_source = 'inferred',
  singles_rating = inferred.ntrp,
  doubles_rating = inferred.ntrp,
  overall_rating = inferred.ntrp
from inferred_baselines inferred
where player.id = inferred.player_id
  and player.external_source = 'tennisrecord'
  and player.is_external_provisional is true
  and player.rating_source = 'self'
  and not exists (
    select 1
    from public.tennisrecord_ntrp_observations observation
    where observation.canonical_player_id = player.id
  );

-- Older parser revisions could create a synthetic higher-priority tenaceiq
-- observation from a TennisRecord-only canonical match. Remove only that
-- synthetic row, then repair the canonical line from the latest staged source
-- evidence. Verified local/captain/user records are not candidates here.
delete from public.tennisrecord_match_observations observation
using public.tennisrecord_canonical_matches canonical,
      public.matches match
where observation.fingerprint = canonical.fingerprint
  and observation.source = 'tenaceiq'
  and observation.source_record_id = match.id::text
  and canonical.canonical_match_id = match.id
  and match.source = 'tennisrecord';

with latest_staged as (
  select distinct on (fingerprint)
    fingerprint,
    score_text,
    winner_side
  from public.tennisrecord_staged_matches
  where parse_status = 'valid'
    and winner_side is not null
  order by fingerprint, parser_revision desc, last_seen_at desc
)
update public.matches as match
set
  score = staged.score_text,
  winner_side = staged.winner_side
from public.tennisrecord_canonical_matches canonical
join latest_staged staged on staged.fingerprint = canonical.fingerprint
where canonical.canonical_match_id = match.id
  and match.source = 'tennisrecord'
  and (match.score is distinct from staged.score_text
    or match.winner_side is distinct from staged.winner_side);

-- The native TiQ rating batch will rebuild from the corrected source data and
-- the inferred baselines. It runs outside the collector checkpoint so imports
-- remain responsive and rate-limited.
update public.tennisrecord_collector_settings
set
  rating_recalculation_requested_at = timezone('utc', now()),
  rating_recalculation_reason = 'inferred_adult_flight_baselines_and_score_repairs'
where id = true;

commit;
