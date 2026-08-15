alter table public.club_groups
  add column if not exists renewal_target_roster_size integer,
  add column if not exists renewal_fill_completed_at timestamptz;
alter table public.club_groups
  drop constraint if exists club_groups_renewal_target_roster_size_check;
alter table public.club_groups
  add constraint club_groups_renewal_target_roster_size_check
  check (renewal_target_roster_size is null or renewal_target_roster_size >= 0);
update public.club_groups club_group
set renewal_target_roster_size = renewal_count.total
from (
  select group_id, count(*)::integer as total
  from public.club_group_renewals
  group by group_id
) renewal_count
where club_group.id = renewal_count.group_id
  and club_group.renewals_finalized_at is not null
  and club_group.renewal_target_roster_size is null;
create index if not exists club_groups_renewal_fill_open_idx
  on public.club_groups (club_id, renewal_target_roster_size)
  where renewals_finalized_at is not null and renewal_fill_completed_at is null;
