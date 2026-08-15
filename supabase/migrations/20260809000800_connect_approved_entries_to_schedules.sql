create or replace function public.is_approved_tiq_league_entrant(p_league_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tiq_player_league_entries entry
    where entry.league_id::text = p_league_id
      and entry.created_by_user_id = auth.uid()
      and entry.entry_status = 'active'
  );
$$;
create or replace function public.is_approved_tiq_tournament_entrant(p_tournament_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tiq_tournament_entries entry
    where entry.tournament_id::text = p_tournament_id
      and entry.submitted_by_user_id = auth.uid()
      and entry.status = 'approved'
  );
$$;
create or replace function public.can_read_approved_player_schedule_item(
  p_league_id text,
  p_participant_a_id text,
  p_participant_b_id text,
  p_participant_a_name text,
  p_participant_b_name text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tiq_player_league_entries entry
    where entry.league_id::text = p_league_id
      and entry.created_by_user_id = auth.uid()
      and entry.entry_status = 'active'
      and (
        (
          nullif(trim(coalesce(entry.player_id, '')), '') is not null
          and entry.player_id::text in (p_participant_a_id, p_participant_b_id)
        )
        or lower(trim(entry.player_name)) in (
          lower(trim(coalesce(p_participant_a_name, ''))),
          lower(trim(coalesce(p_participant_b_name, '')))
        )
      )
  );
$$;
revoke all on function public.is_approved_tiq_league_entrant(text) from public;
revoke all on function public.is_approved_tiq_tournament_entrant(text) from public;
revoke all on function public.can_read_approved_player_schedule_item(text, text, text, text, text) from public;
grant execute on function public.is_approved_tiq_league_entrant(text) to anon, authenticated;
grant execute on function public.is_approved_tiq_tournament_entrant(text) to anon, authenticated;
grant execute on function public.can_read_approved_player_schedule_item(text, text, text, text, text) to anon, authenticated;
drop policy if exists "Approved entrants can read their TIQ competitions" on public.tiq_leagues;
create policy "Approved entrants can read their TIQ competitions"
on public.tiq_leagues
for select
to authenticated
using (public.is_approved_tiq_league_entrant(tiq_leagues.id::text));
drop policy if exists "Approved entrants can read their TIQ tournaments" on public.tiq_tournaments;
create policy "Approved entrants can read their TIQ tournaments"
on public.tiq_tournaments
for select
to authenticated
using (public.is_approved_tiq_tournament_entrant(tiq_tournaments.id::text));
drop policy if exists "TIQ league schedule items are readable" on public.tiq_league_schedule_items;
create policy "TIQ league schedule items are readable"
on public.tiq_league_schedule_items
for select
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id::text = tiq_league_schedule_items.league_id::text
      and (
        tiq_leagues.is_public = true
        or tiq_leagues.created_by_user_id = auth.uid()
        or tiq_league_schedule_items.created_by_user_id = auth.uid()
        or tiq_league_schedule_items.proposed_by_user_id = auth.uid()
      )
  )
  or public.can_read_approved_player_schedule_item(
    tiq_league_schedule_items.league_id::text,
    coalesce(tiq_league_schedule_items.participant_a_id::text, ''),
    coalesce(tiq_league_schedule_items.participant_b_id::text, ''),
    tiq_league_schedule_items.participant_a_name,
    tiq_league_schedule_items.participant_b_name
  )
);
comment on policy "Approved entrants can read their TIQ competitions" on public.tiq_leagues is
'Lets an approved player open the league they joined and receive its dates in My Calendar.';
comment on policy "Approved entrants can read their TIQ tournaments" on public.tiq_tournaments is
'Lets an approved player open the tournament they joined and receive its bracket dates in My Calendar.';
