begin;

-- Improvement plans reuse the existing private account-notebook storage and
-- erasure path. Assessments are referenced, never copied into a plan.
create function public.native_tiq_growth_read(p_owner uuid,p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare plans jsonb; chosen jsonb; before_rating jsonb; after_rating jsonb; more boolean;
begin
  if not private.native_player_chat_account(p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
  select coalesce(jsonb_agg(g.payload order by (g.payload->>'state'='active') desc,g.edited_at desc,g.goal_id desc),'[]') into plans
    from (select payload,edited_at,goal_id from public.my_lab_goals
      where user_id=p_owner and player_id='tiq-growth:v1' and payload is not null
      order by (payload->>'state'='active') desc,edited_at desc,goal_id desc limit 26) g;
  more := jsonb_array_length(plans)>25;
  if more then plans:=plans-25; end if;
  if p_id is null then chosen:=plans->0;
  else select payload into chosen from public.my_lab_goals where user_id=p_owner and player_id='tiq-growth:v1' and goal_id=p_id::text and payload is not null; end if;
  if chosen is not null then
    select private.tiq_self_assessment_json(a) into before_rating from private.tiq_self_assessments a where owner_id=p_owner and id=(chosen->>'baseline')::uuid;
    select private.tiq_self_assessment_json(a) into after_rating from private.tiq_self_assessments a where owner_id=p_owner and id=(chosen->>'assessment')::uuid;
  end if;
  select coalesce(jsonb_agg(value-'logs'||jsonb_build_object('completed',jsonb_array_length(value->'logs'))),'[]') into plans from jsonb_array_elements(plans);
  return jsonb_build_object('ok',true,'owner',p_owner,'plans',plans,'more',more,'selected',chosen,'baseline',before_rating,'reassessment',after_rating);
end;
$$;

create function public.write_native_tiq_growth(p_owner uuid,p_write jsonb)
returns integer language plpgsql security definer set search_path = '' set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare kind text:=p_write->>'kind'; key text:=p_write->>'id'; op uuid:=(p_write->>'operation')::uuid;
  existing jsonb; updated jsonb; baseline private.tiq_self_assessments; after_rating private.tiq_self_assessments;
  item jsonb; block jsonb:=p_write->'block'; changed timestamptz:=clock_timestamp(); source text:=p_write->>'sourceAssignment'; existed boolean;
begin
  if not private.native_player_chat_account(p_owner) then return 403; end if;
  perform pg_advisory_xact_lock(hashtextextended('tiq-growth:'||p_owner::text,0));
  if kind is null or kind not in ('new','log','review','archive') or key is null or op is null or key::uuid is null then return 400; end if;
  select payload into existing from public.my_lab_goals where user_id=p_owner and player_id='tiq-growth:v1' and goal_id=key for update;
  existed:=found;
  if existing->>'revision'=op::text then if existing->>'requestHash'=md5(p_write::text) then return 200; else return 409; end if; end if;
  if kind='new' then
    if p_write->>'expected' is not null then return 400; end if;
    if existed and existing is null then return 409; end if;
    if existing is not null then
      if existing->>'baseline'=p_write->>'baseline' and existing->'block'=block and (existing->>'sourceAssignment') is not distinct from source then return 200; end if;
      return 409;
    end if;
    if exists(select 1 from public.my_lab_goals where user_id=p_owner and player_id='tiq-growth:v1' and payload->>'state'='active') then return 409; end if;
    select * into baseline from private.tiq_self_assessments where owner_id=p_owner and id=(p_write->>'baseline')::uuid;
    if baseline.id is null then return 404; end if;
    if block is null or jsonb_typeof(block)<>'object' or not block ?& array['version','skill','target','sessions','reviewDate']
      or block->>'version' is distinct from '1' or coalesce(block->>'skill','') not in ('serve','return','rally','movement','net','points')
      or jsonb_typeof(block->'target') is distinct from 'string' or length(btrim(block->>'target')) not between 1 and 240
      or jsonb_typeof(block->'sessions') is distinct from 'number' or block->>'sessions' not in ('1','2','3','4','5','6','7','8','9','10','11','12')
      or jsonb_typeof(block->'reviewDate') is distinct from 'string' or coalesce(block->>'reviewDate','') !~ '^\d{4}-\d{2}-\d{2}$'
      or (block->>'reviewDate')::date < current_date-1 or (block->>'reviewDate')::date>current_date+366 then return 400; end if;
    if source is not null and not exists(
      select 1 from public.coach_assignments a join public.coach_player_links l on l.id=a.student_link_id and l.coach_user_id=a.coach_user_id
      where a.id=source and l.player_user_id=p_owner and l.coach_user_id<>p_owner
        and l.status in ('active','needs_assignment','review_notes') and a.status='assigned'
        and private.native_player_chat_account(l.coach_user_id) and private.native_player_chat_unblocked(p_owner,l.coach_user_id)
        and a.assignment_json->'tiqGrowth'=block
    ) then return 403; end if;
    updated:=jsonb_build_object('id',key,'baseline',baseline.id,'sourceAssignment',source,'block',block,'state','active',
      'logs','[]'::jsonb,'assessment',null,'revision',op,'createdAt',changed,'updatedAt',changed,'requestHash',md5(p_write::text));
    insert into public.my_lab_goals(user_id,player_id,goal_id,payload,edited_at) values(p_owner,'tiq-growth:v1',key,updated,changed);
    return 200;
  end if;
  if existing is null then return 404; end if;
  -- Semantic receipts survive later changes; an old retry never reapplies work.
  if kind='log' then
    select value into item from jsonb_array_elements(existing->'logs') where value->>'id'=p_write->'session'->>'id';
    if item is not null then if item=p_write->'session' then return 200; else return 409; end if; end if;
  elsif kind='review' and existing->>'assessment'=p_write->>'assessment' and existing->>'state'='reviewed' then return 200;
  elsif kind='archive' and existing->>'state'='archived' then return 200; end if;
  if existing->>'revision' is distinct from p_write->>'expected' or existing->>'state'<>'active' then return 409; end if;
  if kind='log' then
    item:=p_write->'session';
    if item is null or jsonb_typeof(item)<>'object' or not item ?& array['id','date','note']
      or jsonb_array_length(existing->'logs')>=24 or (item->>'id')::uuid is null or jsonb_typeof(item->'note') is distinct from 'string'
      or jsonb_typeof(item->'date') is distinct from 'string' or coalesce(item->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
      or length(item->>'note')>160 or (item->>'date')::date>current_date+1
      or (item->>'date')::date<(existing->>'createdAt')::timestamptz::date-1 then return 400; end if;
    updated:=jsonb_set(existing,'{logs}',(existing->'logs')||jsonb_build_array(item));
  elsif kind='review' then
    select * into after_rating from private.tiq_self_assessments where owner_id=p_owner and id=(p_write->>'assessment')::uuid;
    if after_rating.id is null then return 404; end if;
    select * into baseline from private.tiq_self_assessments where owner_id=p_owner and id=(existing->>'baseline')::uuid;
    if after_rating.id=(existing->>'baseline')::uuid or after_rating.created_at<=(existing->>'createdAt')::timestamptz
      or (baseline.id is not null and after_rating.assessed_on<baseline.assessed_on) then return 409; end if;
    updated:=existing||jsonb_build_object('assessment',after_rating.id,'state','reviewed');
  else updated:=existing||jsonb_build_object('state','archived'); end if;
  updated:=updated||jsonb_build_object('revision',op,'updatedAt',changed,'requestHash',md5(p_write::text));
  if octet_length(updated::text)>39000 then return 413; end if;
  update public.my_lab_goals set payload=updated,edited_at=changed where user_id=p_owner and player_id='tiq-growth:v1' and goal_id=key;
  return 200;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then return 400;
end;
$$;

-- Invalid legacy timestamps cannot make a coach's entire overview fail.
create function private.tiq_growth_timestamp(value text,fallback timestamptz) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin return coalesce(value::timestamptz,fallback); exception when others then return fallback; end;
$$;

create function public.native_coach_growth_overview(p_owner uuid,p_day date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rows jsonb; counts jsonb; limited boolean; has_more boolean;
begin
  if not private.native_player_chat_account(p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
  if p_day is null or p_day not between current_date-1 and current_date+1 then return jsonb_build_object('ok',false,'status',400); end if;
  with roster_all as materialized (
    select id,player_name,status,updated_at from public.coach_player_links where coach_user_id=p_owner
      order by updated_at desc,id limit 501
  ), roster as materialized (select * from roster_all order by updated_at desc,id limit 500), work_all as materialized (
    select a.id,a.student_link_id,a.title,a.status,a.assignment_json,a.updated_at from public.coach_assignments a
      join roster l on l.id=a.student_link_id where a.coach_user_id=p_owner and a.status in ('draft','assigned','completed')
      order by a.updated_at desc,a.id limit 2001
  ), work as materialized (select * from work_all order by updated_at desc,id limit 2000), flags as (
    select a.*,jsonb_typeof(a.assignment_json->'playerCheckIn')='object'
      and coalesce(a.assignment_json#>>'{playerCheckIn,completedAt}','')<>'' as checked,
      jsonb_typeof(a.assignment_json->'coachReview')='object' and coalesce(a.assignment_json#>>'{coachReview,reviewedAt}','')<>''
      and (length(btrim(coalesce(a.assignment_json#>>'{coachReview,note}','')))>0 or length(btrim(coalesce(a.assignment_json#>>'{coachReview,nextFocus}','')))>0) as reviewed
    from work a
  ), attention as (
    select 'feedback' kind,l.id student,l.player_name name,a.id assignment,a.title,
      private.tiq_growth_timestamp(a.assignment_json#>>'{playerCheckIn,completedAt}',a.updated_at) since
      from flags a join roster l on l.id=a.student_link_id where a.status='completed' and a.checked and not coalesce(a.reviewed,false)
    union all
    select 'plan',l.id,l.player_name,null::text,'Choose the next practice focus',l.updated_at
      from roster l where l.status<>'paused' and not exists(select 1 from work a where a.student_link_id=l.id and a.status in ('assigned','draft'))
        and not exists(select 1 from flags a where a.student_link_id=l.id and a.status='completed' and a.checked and not coalesce(a.reviewed,false))
    union all
    select 'reassess',l.id,l.player_name,a.id,a.title,
      private.tiq_growth_timestamp((a.assignment_json#>>'{tiqGrowth,reviewDate}')||'T12:00:00Z',a.updated_at)
      from work a join roster l on l.id=a.student_link_id where l.status<>'paused' and a.status='assigned'
      and a.assignment_json#>>'{tiqGrowth,version}'='1'
      and a.assignment_json#>>'{tiqGrowth,reviewDate}' ~ '^\d{4}-\d{2}-\d{2}$'
      and a.assignment_json#>>'{tiqGrowth,reviewDate}'<=p_day::text
  ), first_page as (select * from attention order by since,kind,student,assignment limit 26)
  select coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'student',student,'name',name,'assignment',assignment,'title',title,'since',since)
    order by since,kind,student,assignment) from first_page),'[]'),
    (select jsonb_build_object('feedback',count(*) filter(where kind='feedback'),'plan',count(*) filter(where kind='plan'),'reassess',count(*) filter(where kind='reassess')) from attention),
    (select count(*)>500 from roster_all) or (select count(*)>2000 from work_all)
    into rows,counts,limited;
  has_more:=jsonb_array_length(rows)>25;
  if has_more then rows:=rows-25; end if;
  return jsonb_build_object('ok',true,'owner',p_owner,'checkedAt',clock_timestamp(),'day',p_day,'rows',rows,
    'counts',counts,'more',has_more,'limited',limited);
end;
$$;

revoke all on function private.tiq_growth_timestamp(text,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.native_tiq_growth_read(uuid,uuid),public.write_native_tiq_growth(uuid,jsonb),public.native_coach_growth_overview(uuid,date) from public,anon,authenticated;
grant execute on function public.native_tiq_growth_read(uuid,uuid),public.write_native_tiq_growth(uuid,jsonb),public.native_coach_growth_overview(uuid,date) to service_role;
notify pgrst,'reload schema';
commit;
