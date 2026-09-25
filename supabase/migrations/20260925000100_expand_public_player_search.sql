-- Show more name matches without changing the public search function signature.
-- The result cap remains bounded for anonymous searches.
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
      position(normalized.value in lower(player.name)) > 0 as direct_match,
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
  order by direct_match desc, score desc, name asc, id asc
  limit least(greatest(coalesce(result_limit, 8), 1), 24);
$$;

revoke all on function public.search_public_players(text, integer) from public;
grant execute on function public.search_public_players(text, integer) to anon, authenticated, service_role;
