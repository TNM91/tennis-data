do $$
begin
  if to_regclass('public.tiq_leagues') is not null then
    alter table public.tiq_leagues
    add column if not exists photo_url text not null default '';

    alter table public.tiq_leagues
    add column if not exists scoring_system text not null default 'standard';

    alter table public.tiq_leagues
    drop constraint if exists tiq_leagues_scoring_system_check;

    alter table public.tiq_leagues
    add constraint tiq_leagues_scoring_system_check
    check (scoring_system in ('standard', 'dynamic_points'));
  end if;
end $$;
