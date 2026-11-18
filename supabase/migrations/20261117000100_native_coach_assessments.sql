begin;
set local lock_timeout = '5s';

create table private.native_coach_assessments (
  id uuid primary key,
  student_link_id text not null references public.coach_player_links(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  observation jsonb not null check (jsonb_typeof(observation) = 'object' and octet_length(observation::text) <= 3840),
  created_at timestamptz not null default now(),
  check (coach_id <> player_id)
);
alter table private.native_coach_assessments enable row level security;
revoke all on private.native_coach_assessments from public, anon, authenticated, service_role;
create index native_coach_assessments_player_date on private.native_coach_assessments (player_id, created_at desc, id desc);
create index native_coach_assessments_link_date on private.native_coach_assessments (student_link_id, created_at desc, id desc);
create index native_coach_assessments_coach on private.native_coach_assessments (coach_id);

create function public.native_coach_assessments(p_owner uuid, p_student text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', entry.id, 'observation', entry.observation, 'createdAt', entry.created_at,
    'coach', coalesce(nullif(private.native_player_chat_name(entry.coach_id), 'Tennis player'), 'Your coach')
  ) order by entry.created_at desc, entry.id desc), '[]'::jsonb)
  from (
    select saved.*
    from private.native_coach_assessments saved
    join public.coach_player_links link on link.id = saved.student_link_id
      and link.player_user_id = saved.player_id and link.coach_user_id = saved.coach_id
    where ((p_student is null and saved.player_id = p_owner)
       or (p_student = saved.student_link_id and saved.coach_id = p_owner))
      and link.status in ('active', 'needs_assignment', 'review_notes')
      and private.native_player_chat_account(saved.coach_id)
      and private.native_player_chat_account(saved.player_id)
      and private.native_player_chat_unblocked(saved.coach_id, saved.player_id)
    order by saved.created_at desc, saved.id desc
    limit 12
  ) entry;
$$;

create function public.share_native_coach_assessment(
  p_owner uuid, p_student text, p_link_updated_at timestamptz, p_id uuid, p_observation jsonb
) returns boolean language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare
  recipient uuid;
begin
  select link.player_user_id into recipient
  from public.coach_player_links link
  where link.id = p_student and link.coach_user_id = p_owner and link.updated_at = p_link_updated_at
    and link.player_user_id <> p_owner and link.status in ('active', 'needs_assignment', 'review_notes')
    and private.native_player_chat_account(p_owner) and private.native_player_chat_account(link.player_user_id)
    and private.native_player_chat_unblocked(p_owner, link.player_user_id)
  for update;
  if recipient is null then return false; end if;

  insert into private.native_coach_assessments(id, student_link_id, coach_id, player_id, observation)
  values(p_id, p_student, p_owner, recipient, p_observation)
  on conflict (id) do nothing;

  return exists (
    select 1 from private.native_coach_assessments saved where saved.id = p_id
      and saved.student_link_id = p_student and saved.coach_id = p_owner and saved.player_id = recipient
      and saved.observation = p_observation
  );
end;
$$;

revoke all on function public.native_coach_assessments(uuid,text),
  public.share_native_coach_assessment(uuid,text,timestamptz,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.native_coach_assessments(uuid,text),
  public.share_native_coach_assessment(uuid,text,timestamptz,uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
