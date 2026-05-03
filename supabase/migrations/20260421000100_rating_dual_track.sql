-- Add match_source to matches table so the rating engine knows which track to update
alter table public.matches
  add column if not exists match_source text not null default 'usta';

alter table public.matches
  drop constraint if exists matches_match_source_check;

alter table public.matches
  add constraint matches_match_source_check
  check (match_source in ('usta', 'tiq_team', 'tiq_individual'));

-- All existing rows are USTA imports
update public.matches set match_source = 'usta' where match_source is null or match_source = '';

create index if not exists matches_match_source_idx on public.matches (match_source);

-- Add USTA-only dynamic rating columns to players
alter table public.players
  add column if not exists singles_usta_dynamic_rating numeric,
  add column if not exists doubles_usta_dynamic_rating numeric,
  add column if not exists overall_usta_dynamic_rating numeric,
  add column if not exists usta_base_updated_at timestamptz;

-- Add track column to rating_snapshots so charts can show both lines
alter table public.rating_snapshots
  add column if not exists track text not null default 'tiq';

alter table public.rating_snapshots
  drop constraint if exists rating_snapshots_track_check;

alter table public.rating_snapshots
  add constraint rating_snapshots_track_check
  check (track in ('usta', 'tiq'));

create index if not exists rating_snapshots_track_idx on public.rating_snapshots (track);
