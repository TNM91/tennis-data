do $$
begin
  if to_regclass('public.tiq_leagues') is not null then
    alter table public.tiq_leagues
      add column if not exists scheduling_mode text not null default 'coordinator_fixed',
      add column if not exists default_match_day text not null default '',
      add column if not exists default_match_time text not null default '',
      add column if not exists default_facility text not null default '',
      add column if not exists scheduling_notes text not null default '';

    alter table public.tiq_leagues
      drop constraint if exists tiq_leagues_scheduling_mode_check;

    alter table public.tiq_leagues
      add constraint tiq_leagues_scheduling_mode_check
      check (scheduling_mode in ('coordinator_fixed', 'player_arranged'));
  end if;
end $$;
