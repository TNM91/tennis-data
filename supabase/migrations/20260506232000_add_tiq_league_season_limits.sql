do $$
begin
  if to_regclass('public.tiq_leagues') is not null then
    alter table public.tiq_leagues
      add column if not exists season_status text not null default 'draft',
      add column if not exists starts_on date,
      add column if not exists ends_on date,
      add column if not exists max_weeks int not null default 12,
      add column if not exists max_match_events int not null default 120;

    alter table public.tiq_leagues
      drop constraint if exists tiq_leagues_season_status_check;

    alter table public.tiq_leagues
      add constraint tiq_leagues_season_status_check
      check (season_status in ('draft', 'active', 'completed', 'archived'));

    alter table public.tiq_leagues
      drop constraint if exists tiq_leagues_season_window_check;

    alter table public.tiq_leagues
      add constraint tiq_leagues_season_window_check
      check (starts_on is null or ends_on is null or ends_on >= starts_on);

    alter table public.tiq_leagues
      drop constraint if exists tiq_leagues_season_limits_check;

    alter table public.tiq_leagues
      add constraint tiq_leagues_season_limits_check
      check (max_weeks between 1 and 52 and max_match_events between 1 and 500);

    create index if not exists tiq_leagues_status_updated_idx
      on public.tiq_leagues (season_status, updated_at desc);
  end if;
end $$;
