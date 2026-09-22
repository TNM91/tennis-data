-- Keep public player search useful when a name is entered with a small typo.
-- Exact substring matching remains the first path in the application; this RPC
-- is only used when that exact path produces no player records.
create extension if not exists pg_trgm with schema extensions;

create index if not exists players_name_trigram_search_idx
  on public.players using gin (lower(name) extensions.gin_trgm_ops);

create or replace function public.search_public_players(
  search_text text,
  result_limit integer default 8
)
returns table (
  id uuid,
  name text,
  location text,
  overall_rating numeric,
  overall_dynamic_rating numeric,
  overall_usta_dynamic_rating numeric
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with normalized as (
    select lower(regexp_replace(btrim(coalesce(search_text, '')), '[[:space:]]+', ' ', 'g')) as value
  ), scored as (
    select
      player.id,
      player.name,
      player.location,
      player.overall_rating,
      player.overall_dynamic_rating,
      player.overall_usta_dynamic_rating,
      greatest(
        similarity(lower(player.name), normalized.value),
        word_similarity(normalized.value, lower(player.name))
      ) as score
    from public.players player
    cross join normalized
    where normalized.value <> ''
      and (
        lower(player.name) % normalized.value
        or lower(player.name) % regexp_replace(normalized.value, '^.*[[:space:]]', '')
      )
  )
  select id, name, location, overall_rating, overall_dynamic_rating, overall_usta_dynamic_rating
  from scored
  order by score desc, name asc
  limit least(greatest(coalesce(result_limit, 8), 1), 8);
$$;

revoke all on function public.search_public_players(text, integer) from public;
grant execute on function public.search_public_players(text, integer) to anon, authenticated, service_role;
