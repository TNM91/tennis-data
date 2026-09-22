alter table public.club_groups
  add column if not exists rollover_source_group_id uuid references public.club_groups(id) on delete set null;

create index if not exists club_groups_rollover_source_idx
  on public.club_groups (rollover_source_group_id)
  where rollover_source_group_id is not null;

create unique index if not exists club_groups_rollover_once_per_season_idx
  on public.club_groups (club_id, rollover_source_group_id, lower(season_label))
  where rollover_source_group_id is not null and is_active = true;

comment on column public.club_groups.rollover_source_group_id is
  'Prior-season Club program copied to create this program while preserving history.';
