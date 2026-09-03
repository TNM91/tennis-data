-- Keep completed seasons available as history without leaving them in active
-- team and captain workflows. A season only closes when every saved match is
-- terminal; postponed or newly-added matches keep it active.
alter table public.team_profile_links
  add column if not exists archived_at timestamptz null;

create index if not exists team_profile_links_profile_active_idx
  on public.team_profile_links (profile_user_id, status, archived_at, updated_at desc);

create or replace function public.archive_finished_tiq_league_season()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league_name text;
begin
  if new.league_id is null then return new; end if;

  -- A league with no schedule remains open. A proposed, confirmed, or
  -- coordinator-set match also keeps the season open.
  if not exists (
    select 1 from public.tiq_league_schedule_items
    where league_id = new.league_id
  ) then return new; end if;

  if exists (
    select 1 from public.tiq_league_schedule_items
    where league_id = new.league_id
      and status not in ('completed', 'cancelled')
  ) then return new; end if;

  select league_name into target_league_name
  from public.tiq_leagues
  where id = new.league_id;
  if coalesce(trim(target_league_name), '') = '' then return new; end if;

  update public.tiq_leagues
  set season_status = 'completed', updated_at = timezone('utc', now())
  where id = new.league_id
    and season_status in ('draft', 'active');

  update public.team_profile_links
  set archived_at = coalesce(archived_at, timezone('utc', now())),
      is_default = false,
      updated_at = timezone('utc', now())
  where status = 'accepted'
    and lower(trim(league_name)) = lower(trim(target_league_name));

  return new;
end;
$$;

drop trigger if exists tiq_league_schedule_archive_finished_season on public.tiq_league_schedule_items;
create trigger tiq_league_schedule_archive_finished_season
after insert or update of status on public.tiq_league_schedule_items
for each row execute function public.archive_finished_tiq_league_season();
