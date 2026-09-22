-- Preserve old observations, but make the parser revision and validation state
-- explicit so previously captured public pages can be replayed safely.
alter table public.tennisrecord_source_pages
  add column if not exists parser_revision integer not null default 1 check (parser_revision > 0);

alter table public.tennisrecord_staged_matches
  add column if not exists parser_revision integer not null default 1 check (parser_revision > 0),
  add column if not exists parse_status text not null default 'valid' check (parse_status in ('valid', 'quarantined', 'superseded')),
  add column if not exists parse_failure_reason text not null default '';

create index if not exists tennisrecord_source_pages_parser_replay_idx
  on public.tennisrecord_source_pages (parser_revision, last_seen_at desc)
  where raw_html is not null and blocked = false;

create index if not exists tennisrecord_staged_matches_parse_status_idx
  on public.tennisrecord_staged_matches (parse_status, last_seen_at desc);

-- These are page headings, not teams. Keep their evidence for audit, but
-- remove them from normal source classification and rating eligibility.
update public.matches
set source = 'tennisrecord_quarantined',
    rating_eligible = false
where source = 'tennisrecord'
  and line_number is null
  and (
    lower(trim(coalesce(home_team, ''))) in ('match results', 'home team', 'away team', 'team name')
    or lower(trim(coalesce(away_team, ''))) in ('match results', 'home team', 'away team', 'team name')
    or coalesce(home_team, '') ~ '^20[0-9]{2}[[:space:]]+Adult'
    or coalesce(away_team, '') ~ '^20[0-9]{2}[[:space:]]+Adult'
  );
