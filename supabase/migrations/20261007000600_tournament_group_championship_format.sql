begin;
-- Adds a draw choice; existing visibility, table privileges, and write policies are unchanged.
alter table public.tiq_tournaments drop constraint if exists tiq_tournaments_format_check;
alter table public.tiq_tournaments add constraint tiq_tournaments_format_check check (format in (
  'single_elimination','round_robin','group_playoffs','round_robin_first_match_consolation',
  'modified_feed_in_consolation','compass_draw','voluntary_consolation','first_match_consolation',
  'team_tournament','feed_in_consolation','curtis_consolation','flighted_draw'
));
create or replace function public.guard_scored_tournament_group_field()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (old.format = 'group_playoffs' or new.format = 'group_playoffs') and old.results <> '{}'::jsonb
    and (old.format is distinct from new.format or old.entrants is distinct from new.entrants) then
    raise exception 'Clear recorded results before changing the group field or format.';
  end if;
  return new;
end $$;
create trigger guard_scored_tournament_group_field before update of format,entrants on public.tiq_tournaments
for each row execute function public.guard_scored_tournament_group_field();
notify pgrst, 'reload schema';
commit;
