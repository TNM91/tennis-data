import {afterEach,beforeEach,expect,it} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {growthSnapshotWire,readGrowthSnapshot} from '../tiq-growth'
import {readCoachGrowthOverview} from '../coach-growth-overview'
const player='11111111-1111-4111-8111-111111111111',coach='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333'
const id=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')
const answers={serve:2,return:2,rally:2,movement:2,net:2,points:2},block={version:1,skill:'serve',target:'7 of 10 second serves in',sessions:3,reviewDate:new Date(Date.now()+7*86400000).toISOString().slice(0,10)}
let db:PGlite,day:string
const write=async(w:unknown,owner=player)=>(await db.query<{s:number}>('select write_native_tiq_growth($1,$2) s',[owner,JSON.stringify(w)])).rows[0].s
const read=async(owner=player,selected:string|null=null)=>readGrowthSnapshot((await db.query<{v:unknown}>('select native_tiq_growth_read($1,$2) v',[owner,selected])).rows[0].v,owner)
const create=(n=2)=>({kind:'new',id:id(n),baseline:id(1),block,sourceAssignment:null,expected:null,operation:id(10+n)})
const log=(n=20,expected=id(12))=>({kind:'log',id:id(2),operation:id(n+1),expected,session:{id:id(n),date:day,note:'7/10 serves in'}})
beforeEach(async()=>{
  db=new PGlite();day=(await db.query<{d:string}>('select current_date::text d')).rows[0].d
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
    create table auth.users(id uuid primary key);
    create table coach_player_links(id text primary key,coach_user_id uuid references auth.users(id),player_user_id uuid references auth.users(id),updated_at timestamptz,status text,player_name text);
    create table coach_assignments(id text primary key,coach_user_id uuid references auth.users(id),student_link_id text,title text,status text,assignment_json jsonb,updated_at timestamptz);
    create table my_lab_goals(user_id uuid references auth.users(id) on delete cascade,player_id text,goal_id text,payload jsonb,edited_at timestamptz,primary key(user_id,player_id,goal_id));
    create table private.blocks(a uuid,b uuid);
    create function private.native_player_chat_account(owner uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=owner)$$;
    create function private.native_player_chat_unblocked(a uuid,b uuid) returns boolean language sql as $$select not exists(select 1 from private.blocks s where (s.a=a and s.b=b) or (s.a=b and s.b=a))$$;
    create function private.native_player_chat_name(owner uuid) returns text language sql as $$select 'Coach Alex'::text$$;
    insert into auth.users values('${player}'),('${coach}'),('${other}');
    insert into coach_player_links values('student-one','${coach}','${player}',now(),'active','Alex Player');`)
  for(const migration of ['20261120000100_native_tiq_account_history.sql','20261120000200_native_tiq_growth.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+migration,import.meta.url),'utf8'))
  await db.query('select write_native_tiq_assessment($1,$2)',[player,JSON.stringify({kind:'save',id:id(1),date:day,answers,expectedHead:null,version:1})])
})
afterEach(async()=>{await db?.close()})
it('keeps one private plan per owner, references assessments and survives retries without losing newer logs',async()=>{
  expect(await write(create())).toBe(200);expect(await write(create(3))).toBe(409)
  expect(await write(log())).toBe(200);expect(await write(log(22,id(21)))).toBe(200)
  expect(await write(log())).toBe(200);expect(await write(create())).toBe(200)
  expect(await write({...log(),session:{...log().session,note:'changed'}})).toBe(409)
  const snapshot=await read();expect(snapshot.selected?.logs).toHaveLength(2);expect(snapshot.plans[0].completed).toBe(2)
  expect(readGrowthSnapshot(growthSnapshotWire(snapshot),player)).toEqual(snapshot)
  expect((await read(other,id(2))).selected).toBeNull();expect((await read(coach)).plans).toEqual([])
  await db.query('delete from private.tiq_self_assessments where owner_id=$1',[player])
  expect((await read()).baseline).toBeNull();expect((await read()).selected?.logs).toHaveLength(2)
})
it('requires a fresh owned reassessment and does not turn practices into rating changes',async()=>{
  await write(create());expect(await write({kind:'review',id:id(2),operation:id(30),expected:id(12),assessment:id(1)})).toBe(409)
  await db.query('select write_native_tiq_assessment($1,$2)',[player,JSON.stringify({kind:'save',id:id(3),date:day,answers:{...answers,serve:3},expectedHead:id(1),version:1})])
  const review={kind:'review',id:id(2),operation:id(30),expected:id(12),assessment:id(3)}
  expect(await write(review)).toBe(200);expect(await write(review)).toBe(200)
  expect((await read()).reassessment?.answers.serve).toBe(3)
  expect(await write(log())).toBe(409)
})
it('rejects another owner’s baseline, malformed logs, stale versions and attempts to resurrect an archived plan',async()=>{
  expect(await write(create(),other)).toBe(404);await write(create())
  expect(await write({...log(),session:{}})).toBe(400)
  expect(await write({...log(),session:{...log().session,date:null}})).toBe(400)
  expect(await write(log(20,id(99)))).toBe(409)
  expect(await write({kind:'archive',id:id(2),operation:id(40),expected:id(12)})).toBe(200)
  expect(await write(create(3))).toBe(200);expect(await write(create())).toBe(200)
  expect((await read()).plans.filter(p=>p.state==='active').map(p=>p.id)).toEqual([id(3)])
})
it('rejects null block fields at the database boundary and erases private plans with their account',async()=>{
  for(const key of ['version','skill','target','sessions','reviewDate'])expect(await write({...create(),block:{...block,[key]:null}})).toBe(400)
  await write(create());await db.exec('delete from coach_player_links;delete from coach_assignments')
  await db.query('delete from auth.users where id=$1',[player]);expect((await db.query('select * from my_lab_goals')).rows).toEqual([])
})
it('adopts only an assigned matching block through a live unblocked coach link',async()=>{
  const proposed={...create(),sourceAssignment:'assignment-one'}
  expect(await write(proposed)).toBe(403)
  await db.query("insert into coach_assignments values('assignment-one',$1,'student-one','Serve block','assigned',$2,now())",[coach,JSON.stringify({tiqGrowth:block})])
  await db.query('insert into private.blocks values($1,$2)',[player,coach]);expect(await write(proposed)).toBe(403)
  await db.exec('delete from private.blocks');expect(await write({...proposed,block:{...block,sessions:4}})).toBe(403)
  expect(await write(proposed)).toBe(200);expect((await read()).selected?.sourceAssignment).toBe('assignment-one')
})
it('orders roster attention oldest first without duplicating next-plan prompts ahead of feedback',async()=>{
  await db.query("insert into coach_assignments values('review-one',$1,'student-one','Serve check','completed',$2,'2026-11-01T12:00:00Z')",[coach,JSON.stringify({playerCheckIn:{recap:'Done',completedAt:'2026-11-01T12:00:00Z'}})])
  const raw=(await db.query<{v:unknown}>('select native_coach_growth_overview($1,$2) v',[coach,day])).rows[0].v
  const overview=readCoachGrowthOverview(raw,coach,day)
  expect(overview.counts).toEqual({feedback:1,plan:0,reassess:0});expect(overview.rows[0].assignment).toBe('review-one')
  await db.exec(`update coach_assignments set assignment_json=assignment_json||'{"coachReview":{"note":"Good","nextFocus":"Return","reviewedAt":"2026-11-02T12:00:00Z"}}'::jsonb`)
  expect((await db.query<{v:{counts:{plan:number}}}>('select native_coach_growth_overview($1,$2) v',[coach,day])).rows[0].v.counts.plan).toBe(1)
})
it('bounds overview pages honestly and revokes direct authenticated RPC access',async()=>{
  await db.query("insert into coach_player_links select 'extra-'||n,$1,null,now(),'active','Player '||n from generate_series(1,30) n",[coach])
  const data=readCoachGrowthOverview((await db.query<{v:unknown}>('select native_coach_growth_overview($1,$2) v',[coach,day])).rows[0].v,coach,day)
  expect(data.rows).toHaveLength(25);expect(data.more).toBe(true);expect(data.counts.plan).toBe(31)
  await db.exec('set role authenticated')
  await expect(db.query('select native_tiq_growth_read($1)',[player])).rejects.toThrow(/permission denied/)
})
