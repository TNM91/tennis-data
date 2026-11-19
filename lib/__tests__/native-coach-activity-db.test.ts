import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {beforeAll, beforeEach, afterAll, expect, it} from 'vitest'

const coach='11111111-1111-4111-8111-111111111111', player='22222222-2222-4222-8222-222222222222', outsider='33333333-3333-4333-8333-333333333333'
const device='44444444-4444-4444-8444-444444444444', db=new PGlite()
beforeAll(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,private to authenticated,service_role;
    create table public.profiles(id uuid primary key);
    create table public.internal_notifications(id uuid primary key default gen_random_uuid(),recipient_profile_id uuid,actor_user_id uuid,notification_type text,title text,body text,href text,conversation_id uuid,schedule_event_id uuid,read_at timestamptz,created_at timestamptz default clock_timestamp());
    alter table public.internal_notifications enable row level security;
    create policy own_notices on public.internal_notifications for select to authenticated using(recipient_profile_id=auth.uid());
    grant select on public.internal_notifications to authenticated;
    create table public.internal_notification_preferences(profile_id uuid primary key,message_alerts_enabled boolean default true,native_coach_alerts_enabled boolean default false);
    create table public.account_deletion_requests(account_id uuid,status text);
    create table public.team_chat_blocks(owner_user_id uuid,blocked_user_id uuid);
    create table public.coach_player_links(id text primary key,coach_user_id uuid,player_user_id uuid,status text);
    create table public.coach_assignments(id text primary key,coach_user_id uuid,student_link_id text references public.coach_player_links(id) on delete cascade,status text,assignment_json jsonb default '{}');
    create table private.native_hit_push_devices(installation_id uuid primary key,profile_id uuid,device_token text unique,enabled boolean default true,updated_at timestamptz default now(),expires_at timestamptz default now()+interval '30 days',secret_hash text);
    create function private.native_player_chat_account(p_profile uuid) returns boolean language sql as $$select exists(select 1 from public.profiles where id=p_profile)$$;
    grant select,insert,update on public.coach_assignments to authenticated,service_role;
    create view public.native_first_party_updates with(security_invoker=true) as select id,recipient_profile_id,notification_type,title,body,href,conversation_id,schedule_event_id,read_at,created_at from public.internal_notifications where false;
    grant select on public.native_first_party_updates to authenticated;`)
  const original=readFileSync('supabase/migrations/20261114000700_native_chat_hit_push.sql','utf8')
  await db.exec(original.slice(original.indexOf('create function public.bind_native_hit_push('),original.indexOf('create function public.claim_native_hit_push(')))
  await db.exec(readFileSync('supabase/migrations/20261119000100_native_coach_activity.sql','utf8'))
},30000)
afterAll(()=>db.close())
beforeEach(async()=>{
  await db.exec(`rollback; reset role; select set_config('request.jwt.claim.sub','${coach}',false); select set_config('request.jwt.claim.role','authenticated',false);
    truncate public.internal_notifications,public.coach_assignments,public.coach_player_links,public.profiles cascade;
    truncate public.internal_notification_preferences,public.account_deletion_requests,public.team_chat_blocks,private.native_hit_push_devices;
    insert into profiles values('${coach}'),('${player}'),('${outsider}');
    insert into coach_player_links values('student-one','${coach}','${player}','active');`)
})
const publish=()=>db.exec(`set role authenticated; insert into public.coach_assignments values('practice-one','${coach}','student-one','assigned','{"detail":"Private plan","expectedEvidence":"Private proof"}'); reset role;`)
async function inbox(owner:string){await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);const r=await db.query('select * from public.native_first_party_updates');await db.exec('reset role');return r.rows}
const notices=async()=>(await db.query<{kind:string;notification_id:string}>('select kind,notification_id from private.native_coach_activity_notices')).rows
const checkin=()=>db.exec(`select set_config('request.jwt.claim.sub','',false); select set_config('request.jwt.claim.role','service_role',false); set role service_role;
  update public.coach_assignments set status='completed',assignment_json=assignment_json||'{"playerCheckIn":{"recap":"Deep returns","evidence":"Five reps","completedAt":"2026-11-19T01:00:00Z"}}' where id='practice-one'; reset role;`)
const review=()=>db.exec(`select set_config('request.jwt.claim.sub','${coach}',false); set role authenticated;
  update public.coach_assignments set assignment_json=assignment_json||'{"coachReview":{"note":"Great depth","nextFocus":"Recover early","reviewedAt":"2026-11-19T02:00:00Z"}}' where id='practice-one'; reset role;`)

it('keeps drafts private, creates one notice on publication and projects only verified generic copy',async()=>{
  await db.exec(`set role authenticated;insert into coach_assignments values('practice-one','${coach}','student-one','draft','{}');reset role;`)
  expect(await notices()).toHaveLength(0)
  await db.exec(`set role authenticated;update coach_assignments set status='assigned' where id='practice-one';reset role;`)
  const rows=await inbox(player);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({title:'New coach assignment',href:'/coach?student=student-one&assignment=practice-one&activity=assignment#coach-workspace'})
  expect(await inbox(coach)).toHaveLength(0);expect(await inbox(outsider)).toHaveLength(0)
  await db.exec(`select set_config('request.jwt.claim.sub','${coach}',false);set role authenticated;update coach_assignments set assignment_json='{"detail":"Private plan"}';reset role;`)
  expect(await notices()).toHaveLength(1);expect(JSON.stringify(await inbox(player))).not.toContain('Private plan')
})
it('commits notices atomically and never replays existing work',async()=>{
  await db.exec(`begin;set role authenticated;insert into coach_assignments values('rollback','${coach}','student-one','assigned','{}');rollback;`)
  expect(await notices()).toHaveLength(0);await publish();expect(await notices()).toHaveLength(1)
  await db.exec(`set role authenticated;update coach_assignments set status='assigned';reset role;`);expect(await notices()).toHaveLength(1)
})
it('routes a saved check-in to the coach and feedback to the player without duplicate retry alerts',async()=>{
  await publish();await checkin();expect(await notices()).toHaveLength(2)
  expect(await inbox(player)).toHaveLength(0);expect((await inbox(coach))[0]).toMatchObject({title:'Player check-in ready'})
  await checkin();expect(await notices()).toHaveLength(2);expect(await inbox(coach)).toHaveLength(1)
  await review();expect(await notices()).toHaveLength(3);expect(await inbox(coach)).toHaveLength(0)
  expect((await inbox(player))[0]).toMatchObject({title:'Coach feedback ready'})
  await review();expect(await notices()).toHaveLength(3);expect(await inbox(player)).toHaveLength(1)
})
it('suppresses paused, blocked, deleting and opted-out recipients and never attributes a coach write to the player',async()=>{
  for(const setup of [`update coach_player_links set status='paused'`,`insert into team_chat_blocks values('${player}','${coach}')`,`insert into account_deletion_requests values('${player}','pending')`,`insert into internal_notification_preferences values('${player}',false,true)`]){
    await db.exec(setup);await publish();expect(await notices()).toHaveLength(0)
    await db.exec(`delete from coach_assignments;update coach_player_links set status='active';truncate team_chat_blocks,account_deletion_requests,internal_notification_preferences;select set_config('request.jwt.claim.sub','${coach}',false);`)
  }
  await publish();await db.exec(`set role authenticated;update coach_assignments set status='completed',assignment_json='{"playerCheckIn":{"recap":"Forged","evidence":"x"}}';reset role;`)
  expect((await notices()).map(n=>n.kind)).toEqual(['assignment'])
})
it('removes revoked, reassigned, archived and blocked work from both the list and exact notice lookup',async()=>{
  await publish();expect(await inbox(player)).toHaveLength(1)
  for(const change of [`update coach_player_links set status='paused'`,`update coach_player_links set player_user_id='${outsider}'`,`update coach_assignments set status='archived'`,`insert into team_chat_blocks values('${coach}','${player}')`]){
    await db.exec(change);expect(await inbox(player)).toHaveLength(0)
    await db.exec(`update coach_player_links set status='active',player_user_id='${player}';update coach_assignments set status='assigned';truncate team_chat_blocks;`)
  }
})
it('claims a push once, requires explicit opt-in, and rechecks devices and connection before delivery',async()=>{
  await publish();const [{notification_id:notice}]=await notices()
  await db.exec(`insert into private.native_hit_push_devices(installation_id,profile_id,device_token,enabled,updated_at,expires_at,coach_activity_enabled) values('${device}','${player}','${'a'.repeat(64)}',true,now(),now()+interval '1 day',true);set role service_role;`)
  const claim=()=>db.query(`select * from public.claim_native_coach_activity_push('${coach}','practice-one','assignment')`)
  expect((await claim()).rows).toHaveLength(0)
  await db.exec(`reset role;insert into internal_notification_preferences values('${player}',true,true);set role service_role;`)
  expect((await claim()).rows).toEqual([{notification_id:notice}]);expect((await claim()).rows).toHaveLength(0)
  expect((await db.query(`select * from public.native_coach_activity_push_devices('${notice}')`)).rows).toHaveLength(1)
  await db.exec(`reset role;update coach_player_links set status='paused';set role service_role;`)
  expect((await db.query(`select * from public.native_coach_activity_push_devices('${notice}')`)).rows).toHaveLength(0)
  await db.exec('reset role')
})
it('denies direct private-table reads and push claims from normal users; cascades notices on deletion',async()=>{
  await publish();await db.exec('set role authenticated')
  await expect(db.query('select * from private.native_coach_activity_notices')).rejects.toThrow(/permission denied/)
  await expect(db.query(`select * from public.claim_native_coach_activity_push('${coach}','practice-one','assignment')`)).rejects.toThrow(/permission denied/)
  await db.exec(`reset role;delete from coach_player_links where id='student-one';`)
  expect(await notices()).toHaveLength(0);expect(await inbox(player)).toHaveLength(0)
})
it('keeps old device registration compatible and requires the new capability without weakening its ownership secret',async()=>{
  const secret='c'.repeat(64),token='a'.repeat(64)
  await db.exec('set role service_role')
  const bind=(capability?:boolean,proof=secret)=>db.query(`select public.bind_native_hit_push('${device}','${proof}','${player}','${token}',true${capability===undefined?'':','+capability}) ok`)
  expect((await bind()).rows).toEqual([{ok:true}])
  await db.exec('reset role');expect((await db.query('select coach_activity_enabled from private.native_hit_push_devices')).rows).toEqual([{coach_activity_enabled:false}]);await db.exec('set role service_role')
  expect((await bind(true)).rows).toEqual([{ok:true}]);expect((await bind(false,'wrong-secret')).rows).toEqual([{ok:false}])
  await db.exec('reset role');expect((await db.query('select coach_activity_enabled from private.native_hit_push_devices')).rows).toEqual([{coach_activity_enabled:true}]);await db.exec('set role service_role')
  await bind();await db.exec('reset role');expect((await db.query('select coach_activity_enabled from private.native_hit_push_devices')).rows).toEqual([{coach_activity_enabled:false}])
})
