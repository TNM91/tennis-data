-- Apply a bounded batch of factual score-orientation repairs without attempting
-- an INSERT into matches (which would violate required match fields before
-- Postgres can resolve the id conflict).
create or replace function public.apply_match_score_repairs(score_updates jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if jsonb_typeof(score_updates) <> 'array' then
    raise exception 'score_updates must be a JSON array';
  end if;

  update public.matches as target
  set score = source.score
  from jsonb_to_recordset(score_updates) as source(id uuid, score text)
  where target.id = source.id
    and target.score is distinct from source.score;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.apply_match_score_repairs(jsonb) from public, anon, authenticated;
grant execute on function public.apply_match_score_repairs(jsonb) to service_role;
