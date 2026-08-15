create or replace function public.reply_to_level_up_weekly_plan(
  p_plan_id text,
  p_reply jsonb
)
returns setof public.level_up_weekly_plans
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan_json jsonb;
  v_reply jsonb;
  v_action text;
  v_message text;
  v_now timestamptz := now();
begin
  select plan.plan_json
    into v_plan_json
  from public.level_up_weekly_plans plan
  where plan.id = p_plan_id
    and plan.player_user_id = auth.uid()
    and plan.shared_with_coach
    and jsonb_typeof(plan.plan_json -> 'coachResponse') = 'object'
    and exists (
      select 1
      from public.coach_player_links link
      where link.id = plan.student_link_id
        and link.player_user_id = auth.uid()
        and link.coach_user_id = plan.coach_user_id
        and link.status in ('active', 'needs_assignment', 'review_notes')
    )
  for update;

  if v_plan_json is null then
    raise exception 'Coach update not found.' using errcode = '42501';
  end if;
  if p_reply is null or jsonb_typeof(p_reply) <> 'object' then
    raise exception 'Invalid player reply.' using errcode = '22023';
  end if;

  v_action := p_reply ->> 'action';
  v_message := trim(coalesce(p_reply ->> 'message', ''));
  if v_action is null or v_action not in ('acknowledged', 'question') then
    raise exception 'Choose a valid player reply.' using errcode = '22023';
  end if;
  if v_action = 'question' and v_message = '' then
    raise exception 'Add your question before sending.' using errcode = '22023';
  end if;
  if length(v_message) > 500 then
    raise exception 'Keep your question under 500 characters.' using errcode = '22023';
  end if;
  if v_action = 'acknowledged' then
    v_message := '';
  end if;

  v_reply := jsonb_build_object(
    'action', v_action,
    'message', v_message,
    'playerUserId', auth.uid()::text,
    'updatedAt', v_now
  );

  return query
  update public.level_up_weekly_plans plan
  set plan_json = jsonb_set(v_plan_json, '{coachResponse,playerReply}', v_reply, true),
      updated_at = v_now
  where plan.id = p_plan_id
  returning plan.*;
end;
$$;
revoke all on function public.reply_to_level_up_weekly_plan(text, jsonb) from public;
grant execute on function public.reply_to_level_up_weekly_plan(text, jsonb) to authenticated;
