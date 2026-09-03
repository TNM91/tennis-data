-- A new or restored match after closeout reopens the season and returns its
-- connected teams to active workflow. This keeps the archive reversible for
-- playoffs, rain dates, and data corrections.
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

  select league_name into target_league_name
  from public.tiq_leagues
  where id = new.league_id;
  if coalesce(trim(target_league_name), '') = '' then return new; end if;

  if exists (
    select 1 from public.tiq_league_schedule_items
    where league_id = new.league_id
      and status not in ('completed', 'cancelled')
  ) then
    update public.tiq_leagues
    set season_status = 'active', updated_at = timezone('utc', now())
    where id = new.league_id and season_status = 'completed';

    update public.team_profile_links
    set archived_at = null, updated_at = timezone('utc', now())
    where status = 'accepted'
      and lower(trim(league_name)) = lower(trim(target_league_name))
      and archived_at is not null;
    return new;
  end if;

  if not exists (
    select 1 from public.tiq_league_schedule_items
    where league_id = new.league_id
  ) then return new; end if;

  update public.tiq_leagues
  set season_status = 'completed', updated_at = timezone('utc', now())
  where id = new.league_id and season_status in ('draft', 'active');

  update public.team_profile_links
  set archived_at = coalesce(archived_at, timezone('utc', now())),
      is_default = false,
      updated_at = timezone('utc', now())
  where status = 'accepted'
    and lower(trim(league_name)) = lower(trim(target_league_name));

  return new;
end;
$$;
