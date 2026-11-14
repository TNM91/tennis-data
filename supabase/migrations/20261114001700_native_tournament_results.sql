begin;
set local lock_timeout = '5s';

create function public.native_tournament_save_result(
  p_owner uuid, p_event uuid, p_expected text, p_division text, p_match text, p_result jsonb, p_complete boolean
)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '8s' as $$
declare
  event_key text;
  division public.tiq_tournaments;
  data jsonb;
  result jsonb;
begin
  if p_owner is null or p_event is null or p_complete is null or p_match is null
    or p_match !~ '^r[1-9][0-9]?-m[1-9][0-9]?$' or jsonb_typeof(p_result) is distinct from 'object'
    or jsonb_typeof(p_result->'score') is distinct from 'string' or length(p_result->>'score') > 64
    or coalesce(p_result->>'outcome','') not in ('played','walkover','retirement')
    or p_result->>'outcome' = 'walkover' and p_result->>'score' <> ''
    or p_result->>'outcome' = 'played' and p_result->>'score' = '' then
    return jsonb_build_object('code','invalid');
  end if;
  perform 1 from auth.users where id = p_owner for key share;
  if not found or exists (select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent) then
    return jsonb_build_object('code','missing');
  end if;
  -- Serialize with refunds, draw publication, court edits and entry review.
  select public_id into event_key from private.native_tournament_purchases
    where owner_id = p_owner and event_id = p_event and environment = 'Production' and status = 'paid' for share;
  perform 1 from public.tiq_tournaments where id = event_key and created_by_user_id = p_owner
    and is_public and is_event and event_id is null for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  select * into division from public.tiq_tournaments where id = p_division and event_id = event_key
    and created_by_user_id = p_owner and is_public and not is_event and id like 'tiq-native-division-%' for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  if division.status not in ('scheduled','completed') or division.status = 'completed' and not p_complete
    or not coalesce(p_result->>'sideA' = any(division.entrants), false)
    or not coalesce(p_result->>'sideB' = any(division.entrants), false)
    or p_result->>'sideA' = p_result->>'sideB'
    or not coalesce(p_result->>'winner' in (p_result->>'sideA',p_result->>'sideB'), false) then
    return jsonb_build_object('code','not_ready');
  end if;
  -- The route validated the scores and both players against this exact draw,
  -- including the rule that a correction may not change a later played match.
  data := private.native_tournament_plan_data(event_key);
  if p_expected is distinct from md5(data::text) or data is null then return jsonb_build_object('code','stale'); end if;
  result := jsonb_build_object('winner', p_result->>'winner', 'sideA', p_result->>'sideA', 'sideB', p_result->>'sideB',
    'score', p_result->>'score', 'outcome', p_result->>'outcome', 'updatedAt', clock_timestamp());
  update public.tiq_tournaments set results = jsonb_set(results, array[p_match], result, true),
    status = case when p_complete then 'completed' else 'scheduled' end, updated_by_user_id = p_owner where id = division.id;
  if p_complete and not exists (
    select 1 from public.tiq_tournaments item where item.event_id = event_key and item.is_public and item.status <> 'completed'
  ) then
    update public.tiq_tournaments set status = 'completed', updated_by_user_id = p_owner
    where id = event_key and status <> 'completed';
  end if;
  data := private.native_tournament_plan_data(event_key);
  return data || jsonb_build_object('revision', md5(data::text));
end;
$$;

revoke all on function public.native_tournament_save_result(uuid,uuid,text,text,text,jsonb,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.native_tournament_save_result(uuid,uuid,text,text,text,jsonb,boolean) to service_role;

notify pgrst, 'reload schema';
commit;
