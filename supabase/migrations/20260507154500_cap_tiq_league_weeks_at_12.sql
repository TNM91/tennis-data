do $$
begin
  if to_regclass('public.tiq_leagues') is not null then
    update public.tiq_leagues
      set
        max_weeks = 12,
        ends_on = case
          when starts_on is not null then starts_on + interval '83 days'
          else ends_on
        end
      where max_weeks > 12;

    alter table public.tiq_leagues
      drop constraint if exists tiq_leagues_season_limits_check;

    alter table public.tiq_leagues
      add constraint tiq_leagues_season_limits_check
      check (max_weeks between 1 and 12 and max_match_events between 1 and 500);
  end if;
end $$;
