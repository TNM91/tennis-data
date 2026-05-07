alter table public.tiq_leagues
  add column if not exists schedule_time_zone text not null default 'America/Chicago';

update public.tiq_leagues
set schedule_time_zone = 'America/Chicago'
where trim(coalesce(schedule_time_zone, '')) = '';
