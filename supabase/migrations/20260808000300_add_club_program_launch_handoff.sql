alter table public.club_groups
  add column if not exists launch_handoff_completed_at timestamptz;

create index if not exists club_groups_pending_launch_handoff_idx
  on public.club_groups (club_id, updated_at desc)
  where is_active = true and launch_handoff_completed_at is null;
