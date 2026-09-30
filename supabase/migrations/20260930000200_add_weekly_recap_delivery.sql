alter table public.tiq_league_weekly_deliveries
  drop constraint if exists tiq_league_weekly_deliveries_delivery_kind_check;

alter table public.tiq_league_weekly_deliveries
  add constraint tiq_league_weekly_deliveries_delivery_kind_check
  check (delivery_kind in ('availability_open', 'court_plan', 'recap'));
