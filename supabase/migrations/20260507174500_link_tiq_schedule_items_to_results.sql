do $$
begin
  if to_regclass('public.tiq_individual_league_results') is not null then
    alter table public.tiq_individual_league_results
      add column if not exists schedule_item_id uuid references public.tiq_league_schedule_items(id) on delete set null;

    create unique index if not exists tiq_individual_results_schedule_item_unique
      on public.tiq_individual_league_results(schedule_item_id)
      where schedule_item_id is not null;

    create index if not exists tiq_individual_results_schedule_item_idx
      on public.tiq_individual_league_results(schedule_item_id);
  end if;

  if to_regclass('public.tiq_team_league_match_events') is not null then
    alter table public.tiq_team_league_match_events
      add column if not exists schedule_item_id uuid references public.tiq_league_schedule_items(id) on delete set null;

    create unique index if not exists tiq_team_events_schedule_item_unique
      on public.tiq_team_league_match_events(schedule_item_id)
      where schedule_item_id is not null;

    create index if not exists tiq_team_events_schedule_item_idx
      on public.tiq_team_league_match_events(schedule_item_id);
  end if;
end $$;
