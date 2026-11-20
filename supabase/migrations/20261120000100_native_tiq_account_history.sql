begin;

-- Self assessments stay separate from coach observations. Private tables inherit
-- no Data API access; only the authenticated HTTP handlers call these service RPCs.
create function private.valid_tiq_self_answers(value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) <> 'object' or value is null then false else
    value ?& array['serve','return','rally','movement','net','points']
    and (value ? 'singles-build') = (value ? 'singles-cover')
    and (value ? 'doubles-coverage') = (value ? 'doubles-patterns')
    and not exists(select 1 from jsonb_each(value) entry where entry.key not in
      ('serve','return','rally','movement','net','points','singles-build','singles-cover','doubles-coverage','doubles-patterns')
      or jsonb_typeof(entry.value) <> 'number' or entry.value::text not in ('0','1','2','3')) end;
$$;

create table private.tiq_self_assessments (
  id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  assessed_on date not null,
  answers jsonb not null check(private.valid_tiq_self_answers(answers)),
  model_version integer not null default 1 check(model_version = 1),
  created_at timestamptz not null default clock_timestamp(),
  primary key(id,owner_id)
);
create index tiq_self_assessment_history on private.tiq_self_assessments(owner_id,assessed_on desc,created_at desc,id desc);
create table private.tiq_self_assessment_shares (
  assessment_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_link_id text not null references public.coach_player_links(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  link_updated_at timestamptz not null,
  operation_id uuid not null,
  is_shared boolean not null,
  primary key(assessment_id,owner_id,student_link_id),
  foreign key(assessment_id,owner_id) references private.tiq_self_assessments(id,owner_id) on delete cascade,
  check(owner_id <> coach_id)
);
create index tiq_self_assessment_coach on private.tiq_self_assessment_shares(coach_id,student_link_id,assessment_id) where is_shared;
alter table private.tiq_self_assessments enable row level security;
alter table private.tiq_self_assessment_shares enable row level security;
revoke all on private.tiq_self_assessments,private.tiq_self_assessment_shares from public,anon,authenticated,service_role;

create function private.tiq_self_assessment_json(entry private.tiq_self_assessments) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id',entry.id,'date',entry.assessed_on,'answers',entry.answers,'createdAt',entry.created_at,'version',entry.model_version);
$$;

create function public.native_tiq_assessment_history(p_owner uuid,p_cursor jsonb default null,p_student text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  player uuid := p_owner;
  entries jsonb;
  first_entry jsonb;
  next_page jsonb := null;
  connections jsonb := '[]';
  share_rows jsonb := '[]';
  more_connections boolean := false;
begin
  if not private.native_player_chat_account(p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
  if p_student is not null then
    select l.player_user_id into player from public.coach_player_links l
      where l.id=p_student and l.coach_user_id=p_owner and l.player_user_id<>p_owner
        and l.status in ('active','needs_assignment','review_notes')
        and private.native_player_chat_account(l.player_user_id)
        and private.native_player_chat_unblocked(p_owner,l.player_user_id);
    if player is null then return jsonb_build_object('ok',false,'status',403); end if;
  end if;
  with visible as not materialized (
    select a.* from private.tiq_self_assessments a where a.owner_id=player
      and (p_student is null or exists (
        select 1 from private.tiq_self_assessment_shares s join public.coach_player_links l on l.id=s.student_link_id
        where s.assessment_id=a.id and s.owner_id=player and s.coach_id=p_owner and s.student_link_id=p_student
          and s.is_shared and l.updated_at=s.link_updated_at and l.player_user_id=player and l.coach_user_id=p_owner
      ))
  ), page as (
    select v.* from visible v where p_cursor is null or
      (v.assessed_on,v.created_at,v.id)<((p_cursor->>'date')::date,(p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid)
    order by v.assessed_on desc,v.created_at desc,v.id desc limit 26
  ) select coalesce((select jsonb_agg(private.tiq_self_assessment_json(p) order by p.assessed_on desc,p.created_at desc,p.id desc)
      from page p),'[]'),
    (select private.tiq_self_assessment_json(v) from visible v order by v.assessed_on desc,v.created_at desc,v.id desc limit 1)
    into entries,first_entry;
  if jsonb_array_length(entries)>25 then
    entries := entries - 25;
    next_page := jsonb_build_object('id',entries->24->>'id','date',entries->24->>'date','createdAt',entries->24->>'createdAt');
  end if;
  if p_student is null then
    select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',private.native_player_chat_name(l.coach_user_id),
      'updatedAt',l.updated_at) order by l.updated_at desc,l.id),'[]') into connections from (
      select link.* from public.coach_player_links link where link.player_user_id=p_owner and link.coach_user_id<>p_owner
        and link.status in ('active','needs_assignment','review_notes')
        and private.native_player_chat_account(link.coach_user_id)
        and private.native_player_chat_unblocked(p_owner,link.coach_user_id)
      order by link.updated_at desc,link.id limit 51
    ) l;
    if jsonb_array_length(connections)>50 then connections:=connections-50; more_connections:=true; end if;
    select coalesce(jsonb_agg(jsonb_build_object('assessment',s.assessment_id,'student',s.student_link_id,
      'name',private.native_player_chat_name(s.coach_id),'operation',s.operation_id,'shared',s.is_shared,
      'active',coalesce(s.is_shared and l.updated_at=s.link_updated_at and l.coach_user_id=s.coach_id and l.player_user_id=p_owner
        and l.status in ('active','needs_assignment','review_notes') and private.native_player_chat_account(s.coach_id)
        and private.native_player_chat_unblocked(p_owner,s.coach_id),false))),'[]') into share_rows
      from private.tiq_self_assessment_shares s join public.coach_player_links l on l.id=s.student_link_id
      where s.owner_id=p_owner and exists(select 1 from jsonb_array_elements(entries) a where a->>'id'=s.assessment_id::text);
  end if;
  return jsonb_build_object('ok',true,'owner',p_owner,'student',p_student,'head',first_entry,'items',entries,
    'next',next_page,'coaches',connections,'moreCoaches',more_connections,'shares',share_rows);
end;
$$;

create function public.write_native_tiq_assessment(p_owner uuid,p_write jsonb) returns integer
language plpgsql security definer set search_path = '' set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare
  kind text := p_write->>'kind';
  selected uuid := (p_write->>'id')::uuid;
  head uuid;
  existing private.tiq_self_assessments;
  sharing private.tiq_self_assessment_shares;
  coach uuid;
  operation uuid;
begin
  if not private.native_player_chat_account(p_owner) then return 403; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
  if kind='save' then
    if not private.valid_tiq_self_answers(p_write->'answers') or (p_write->>'version')::integer<>1
      or (p_write->>'date')::date>current_date+1 then return 400; end if;
    select * into existing from private.tiq_self_assessments a where a.id=selected and a.owner_id=p_owner;
    if found then
      if existing.owner_id=p_owner and existing.answers=p_write->'answers' and existing.assessed_on=(p_write->>'date')::date then return 200; end if;
      return 409;
    end if;
    select a.id into head from private.tiq_self_assessments a where a.owner_id=p_owner order by a.assessed_on desc,a.created_at desc,a.id desc limit 1;
    if head is distinct from (p_write->>'expectedHead')::uuid then return 409; end if;
    insert into private.tiq_self_assessments(id,owner_id,assessed_on,answers) values(selected,p_owner,(p_write->>'date')::date,p_write->'answers');
    return 200;
  end if;
  if kind='delete' then
    delete from private.tiq_self_assessments a where a.id=selected and a.owner_id=p_owner;
    return 200;
  end if;
  if kind not in ('share','revoke') then return 400; end if;
  if not exists(select 1 from private.tiq_self_assessments a where a.id=selected and a.owner_id=p_owner) then return 404; end if;
  select * into sharing from private.tiq_self_assessment_shares s where s.assessment_id=selected and s.student_link_id=p_write->>'student' and s.owner_id=p_owner for update;
  operation:=(p_write->>'operation')::uuid;
  -- Retrying a lost reply cannot undo a newer share/revoke intent.
  if sharing.operation_id=operation then
    if sharing.is_shared=(kind='share') and (kind='revoke' or sharing.link_updated_at=(p_write->>'linkUpdatedAt')::timestamptz) then return 200; end if;
    return 409;
  end if;
  if sharing.operation_id is distinct from (p_write->>'expected')::uuid then return 409; end if;
  if kind='revoke' then
    update private.tiq_self_assessment_shares set is_shared=false,operation_id=operation
      where assessment_id=selected and student_link_id=p_write->>'student' and owner_id=p_owner;
    return 200;
  end if;
  select l.coach_user_id into coach from public.coach_player_links l where l.id=p_write->>'student'
    and l.player_user_id=p_owner and l.coach_user_id<>p_owner and l.updated_at=(p_write->>'linkUpdatedAt')::timestamptz
    and l.status in ('active','needs_assignment','review_notes')
    and private.native_player_chat_account(l.coach_user_id) and private.native_player_chat_unblocked(p_owner,l.coach_user_id) for share;
  if coach is null then return 409; end if;
  if sharing.operation_id is null and (select count(*) from private.tiq_self_assessment_shares where assessment_id=selected and owner_id=p_owner)>=50 then return 409; end if;
  insert into private.tiq_self_assessment_shares(assessment_id,owner_id,student_link_id,coach_id,link_updated_at,operation_id,is_shared)
    values(selected,p_owner,p_write->>'student',coach,(p_write->>'linkUpdatedAt')::timestamptz,operation,true)
    on conflict(assessment_id,owner_id,student_link_id) do update set coach_id=excluded.coach_id,link_updated_at=excluded.link_updated_at,
      operation_id=excluded.operation_id,is_shared=true;
  return 200;
end;
$$;

revoke all on function private.valid_tiq_self_answers(jsonb),private.tiq_self_assessment_json(private.tiq_self_assessments) from public,anon,authenticated,service_role;
revoke all on function public.native_tiq_assessment_history(uuid,jsonb,text),public.write_native_tiq_assessment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.native_tiq_assessment_history(uuid,jsonb,text),public.write_native_tiq_assessment(uuid,jsonb) to service_role;
-- All new identity references live in private and cascade on account deletion;
-- no public column/FK catalog or erasure function body is changed.
notify pgrst,'reload schema';
commit;
