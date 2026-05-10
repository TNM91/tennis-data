do $$
begin
  if to_regclass('public.tiq_leagues') is not null then
    alter table public.tiq_leagues
    add column if not exists third_set_rule text not null default 'either';

    alter table public.tiq_leagues
    drop constraint if exists tiq_leagues_third_set_rule_check;

    alter table public.tiq_leagues
    add constraint tiq_leagues_third_set_rule_check
    check (third_set_rule in ('either', 'full_set', 'match_tiebreak_10'));
  end if;
end $$;
