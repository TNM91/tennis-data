create or replace function public.respond_to_level_up_weekly_plan(
  p_plan_id text,
  p_response jsonb
)
returns setof public.level_up_weekly_plans
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan_json jsonb;
  v_target_rep jsonb;
  v_response jsonb;
  v_action text;
  v_note text;
  v_target_rep_id text;
  v_replacement jsonb;
  v_now timestamptz := now();
begin
  select plan.plan_json
    into v_plan_json
  from public.level_up_weekly_plans plan
  where plan.id = p_plan_id
    and plan.coach_user_id = auth.uid()
    and plan.shared_with_coach
    and exists (
      select 1
      from public.coach_player_links link
      where link.id = plan.student_link_id
        and link.coach_user_id = auth.uid()
        and link.player_user_id = plan.player_user_id
        and link.status in ('active', 'needs_assignment', 'review_notes')
    )
  for update;

  if v_plan_json is null then
    raise exception 'Shared weekly plan not found.' using errcode = '42501';
  end if;
  if p_response is null or jsonb_typeof(p_response) <> 'object' then
    raise exception 'Invalid coach response.' using errcode = '22023';
  end if;

  v_action := p_response ->> 'action';
  v_note := left(trim(coalesce(p_response ->> 'note', '')), 500);
  v_target_rep_id := nullif(trim(coalesce(p_response ->> 'targetRepId', '')), '');
  v_replacement := p_response -> 'replacementRep';

  if v_action is null or v_action not in ('acknowledged', 'adjusted', 'replaced') then
    raise exception 'Choose a valid coach response.' using errcode = '22023';
  end if;
  if v_action = 'adjusted' and v_note = '' then
    raise exception 'Add the adjustment before sending.' using errcode = '22023';
  end if;

  if v_action <> 'acknowledged' then
    select rep
      into v_target_rep
    from jsonb_array_elements(coalesce(v_plan_json -> 'reps', '[]'::jsonb)) rep
    where rep ->> 'id' = v_target_rep_id
    limit 1;
    if v_target_rep is null then
      raise exception 'Choose a rep from this weekly plan.' using errcode = '22023';
    end if;
  else
    v_target_rep_id := null;
  end if;

  if v_action = 'replaced' then
    if nullif(v_target_rep ->> 'completedAt', '') is not null then
      raise exception 'A completed rep cannot be replaced.' using errcode = '22023';
    end if;
    if jsonb_typeof(v_replacement) <> 'object'
      or coalesce(v_replacement ->> 'title', '') = ''
      or coalesce(v_replacement ->> 'focusId', '') = ''
      or coalesce(v_replacement ->> 'identitySlug', '') = ''
      or coalesce(v_replacement ->> 'href', '') not like '/level-up/%' then
      raise exception 'Choose a valid replacement rep.' using errcode = '22023';
    end if;
  else
    v_replacement := null;
  end if;

  v_response := jsonb_build_object(
    'action', v_action,
    'note', v_note,
    'targetRepId', v_target_rep_id,
    'replacementRep', v_replacement,
    'coachUserId', auth.uid()::text,
    'updatedAt', v_now
  );

  return query
  update public.level_up_weekly_plans plan
  set plan_json = jsonb_set(v_plan_json, '{coachResponse}', v_response, true),
      updated_at = v_now
  where plan.id = p_plan_id
  returning plan.*;
end;
$$;

revoke all on function public.respond_to_level_up_weekly_plan(text, jsonb) from public;
grant execute on function public.respond_to_level_up_weekly_plan(text, jsonb) to authenticated;
