-- Add bounded, factual match history to player search results. A match team
-- identifies the player at that time; it is not a claim of current membership.
create index if not exists match_players_player_search_idx
  on public.match_players (player_id, match_id);

create or replace function public.get_public_player_search_match_context(player_ids uuid[])
returns table (
  player_id uuid,
  team_name text,
  match_date text
)
language sql
stable
security invoker
set search_path = public
as $$
  select requested.player_id, recent.team_name, recent.match_date
  from (
    select distinct id as player_id
    from unnest((coalesce(player_ids, array[]::uuid[]))[1:24]) as selected(id)
  ) requested
  cross join lateral (
    select
      case when participant.side = 'A' then match_row.home_team else match_row.away_team end as team_name,
      match_row.match_date::text as match_date
    from public.match_players participant
    join public.matches match_row on match_row.id = participant.match_id
    where participant.player_id = requested.player_id
      and participant.side in ('A', 'B')
      and match_row.winner_side in ('A', 'B')
      and nullif(btrim(case when participant.side = 'A' then match_row.home_team else match_row.away_team end), '') is not null
    order by match_row.match_date desc nulls last, match_row.id desc
    limit 1
  ) recent;
$$;

revoke all on function public.get_public_player_search_match_context(uuid[]) from public;
grant execute on function public.get_public_player_search_match_context(uuid[]) to anon, authenticated, service_role;
