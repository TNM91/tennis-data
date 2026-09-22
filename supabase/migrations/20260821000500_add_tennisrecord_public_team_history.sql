-- Keep factual TennisRecord team evidence separate from canonical TenAceIQ
-- rosters and matches. Public projections below are read-only discovery data
-- with source provenance; they never update ratings or local records.
create table if not exists public.tennisrecord_staged_team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_name text not null,
  normalized_team_name text not null,
  source_player_key text not null references public.tennisrecord_staged_players(source_player_key) on delete cascade,
  player_name text not null,
  source_url text not null,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  unique(normalized_team_name, source_player_key)
);
create index if not exists tennisrecord_staged_team_memberships_team_idx
  on public.tennisrecord_staged_team_memberships(normalized_team_name, last_seen_at desc);

alter table public.tennisrecord_staged_team_memberships enable row level security;

create or replace view public.tennisrecord_public_team_roster_context
with (security_invoker = false)
as
select
  membership.team_name,
  membership.normalized_team_name,
  membership.player_name,
  identity.canonical_player_id,
  membership.source_url,
  membership.first_seen_at,
  membership.last_seen_at,
  'tennisrecord'::text as source
from public.tennisrecord_staged_team_memberships membership
join public.tennisrecord_staged_players player
  on player.source_player_key = membership.source_player_key
left join public.tennisrecord_player_identities identity
  on identity.staged_player_id = player.id
  and identity.status = 'matched'
where btrim(membership.team_name) <> ''
  and btrim(membership.player_name) <> '';

create or replace view public.tennisrecord_public_team_match_history
with (security_invoker = false)
as
select
  staged.source_match_key,
  staged.home_team as team_name,
  staged.away_team as opponent_team,
  staged.played_on,
  staged.league_name,
  staged.flight,
  staged.discipline,
  staged.court_number,
  staged.score_text,
  staged.winner_side,
  'A'::text as team_side,
  staged.source_url,
  canonical.canonical_match_id,
  staged.first_seen_at,
  staged.last_seen_at,
  'tennisrecord'::text as source
from public.tennisrecord_staged_matches staged
left join public.tennisrecord_canonical_matches canonical
  on canonical.fingerprint = staged.fingerprint
where staged.parse_status = 'valid'
  and nullif(btrim(staged.home_team), '') is not null
  and nullif(btrim(staged.away_team), '') is not null
union all
select
  staged.source_match_key,
  staged.away_team as team_name,
  staged.home_team as opponent_team,
  staged.played_on,
  staged.league_name,
  staged.flight,
  staged.discipline,
  staged.court_number,
  staged.score_text,
  staged.winner_side,
  'B'::text as team_side,
  staged.source_url,
  canonical.canonical_match_id,
  staged.first_seen_at,
  staged.last_seen_at,
  'tennisrecord'::text as source
from public.tennisrecord_staged_matches staged
left join public.tennisrecord_canonical_matches canonical
  on canonical.fingerprint = staged.fingerprint
where staged.parse_status = 'valid'
  and nullif(btrim(staged.home_team), '') is not null
  and nullif(btrim(staged.away_team), '') is not null;

revoke all on public.tennisrecord_public_team_roster_context from public;
revoke all on public.tennisrecord_public_team_match_history from public;
grant select on public.tennisrecord_public_team_roster_context to anon, authenticated;
grant select on public.tennisrecord_public_team_match_history to anon, authenticated;

comment on table public.tennisrecord_staged_team_memberships is
  'Untrusted source roster observations only. They do not write to public.team_roster_members.';
comment on view public.tennisrecord_public_team_roster_context is
  'Source-labeled player listings parsed only from explicitly labeled public TennisRecord roster tables. It does not establish canonical TenAceIQ membership.';
comment on view public.tennisrecord_public_team_match_history is
  'Source-labeled TennisRecord team match evidence. Canonical matches stay authoritative when a canonical_match_id is present.';
