import {afterEach, beforeEach, expect, it} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {readTiqHistory, type TiqWrite} from '../tiq-self-assessment'

const player='11111111-1111-4111-8111-111111111111', coach='22222222-2222-4222-8222-222222222222', other='33333333-3333-4333-8333-333333333333'
const id=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')
const answers={serve:2,return:2,rally:2,movement:2,net:2,points:2} as const
let db:PGlite
const write=async(owner:string,body: TiqWrite | Record<string,unknown>)=>(await db.query<{status:number}>('select write_native_tiq_assessment($1,$2) status',[owner,JSON.stringify(body)])).rows[0].status
const history=async(owner=player,student:string|null=null,cursor:unknown=null)=>{
  const raw=(await db.query<{value:unknown}>('select native_tiq_assessment_history($1,$2,$3) value',[owner,cursor===null?null:JSON.stringify(cursor),student])).rows[0].value
  return readTiqHistory(raw,owner,student)
}
const save=(n:number,expectedHead:string|null=null,date='2026-11-19')=>({kind:'save',id:id(n),date,answers,expectedHead,version:1} as const)
const share=(n:number,operation=10,expected:string|null=null,kind:'share'|'revoke'='share')=>({kind,id:id(n),student:'student-one',linkUpdatedAt:'2026-11-18T12:00:00Z',operation:id(operation),expected} as const)
beforeEach(async()=>{
  db=new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
    create table auth.users(id uuid primary key);
    create table public.coach_player_links(id text primary key,coach_user_id uuid references auth.users(id),player_user_id uuid references auth.users(id),updated_at timestamptz,status text);
    create table private.blocks(a uuid,b uuid);
    create function private.native_player_chat_account(owner uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=owner)$$;
    create function private.native_player_chat_unblocked(a uuid,b uuid) returns boolean language sql as $$select not exists(select 1 from private.blocks s where (s.a=a and s.b=b) or (s.a=b and s.b=a))$$;
    create function private.native_player_chat_name(owner uuid) returns text language sql as $$select 'Coach Alex'::text$$;
    insert into auth.users values('${player}'),('${coach}'),('${other}');
    insert into coach_player_links values('student-one','${coach}','${player}','2026-11-18T12:00:00Z','active');`)
  await db.exec(await readFile(new URL('../../supabase/migrations/20261120000100_native_tiq_account_history.sql',import.meta.url),'utf8'))
})
afterEach(async()=>{await db?.close()})

it('keeps immutable assessments private, deduplicates a lost reply, and detects another device’s newer save',async()=>{
  expect(await write(player,save(1))).toBe(200)
  expect(await write(player,save(2))).toBe(409)
  expect(await write(player,save(2,id(1)))).toBe(200)
  expect(await write(player,save(1))).toBe(200)
  expect(await write(player,{...save(1),answers:{...answers,serve:3}})).toBe(409)
  expect((await history()).items.map(item=>item.id)).toEqual([id(2),id(1)])
  expect((await history(other)).items).toEqual([])
  expect((await history(coach,'student-one')).items).toEqual([])
  expect((await history()).shares).toEqual([])
})
it('shares only the selected snapshot and fences retries from a newer revoke or re-share',async()=>{
  await write(player,save(1));await write(player,save(2,id(1)))
  expect(await write(other,share(1))).toBe(404)
  expect(await write(player,share(1))).toBe(200)
  expect(await write(player,share(1))).toBe(200)
  expect((await history(coach,'student-one')).items.map(item=>item.id)).toEqual([id(1)])
  expect(await write(player,share(1,11,id(10),'revoke'))).toBe(200)
  expect((await history(coach,'student-one')).items).toEqual([])
  expect(await write(player,share(1))).toBe(409)
  expect(await write(player,share(1,12,id(11)))).toBe(200)
  expect(await write(player,share(1,11,id(10),'revoke'))).toBe(409)
  expect((await history()).shares).toMatchObject([{active:true,operation:id(12)}])
})
it('isolates assessment identifiers by account so an identifier cannot probe, block or delete another player’s snapshot',async()=>{
  expect(await write(player,save(1))).toBe(200)
  expect(await write(other,{...save(1),answers:{...answers,serve:3}})).toBe(200)
  expect((await history()).head?.answers.serve).toBe(2)
  expect((await history(other)).head?.answers.serve).toBe(3)
  await write(other,{kind:'delete',id:id(1)})
  expect((await history()).items).toHaveLength(1)
  expect((await history(other)).items).toHaveLength(0)
})
it('withholds shared answers after a block, pause, relink or changed connection, and lets the player revoke',async()=>{
  await write(player,save(1));await write(player,share(1))
  await db.query('insert into private.blocks values($1,$2)',[player,coach])
  expect((await history()).shares[0].active).toBe(false)
  await expect(history(coach,'student-one')).rejects.toThrow()
  await db.exec('delete from private.blocks')
  await db.exec("update coach_player_links set updated_at='2026-11-19T12:00:00Z',status='paused'")
  expect(await write(player,share(1,12,id(10)))).toBe(409)
  expect(await write(player,share(1,13,id(10),'revoke'))).toBe(200)
  await db.exec("update coach_player_links set status='active'")
  expect((await history(coach,'student-one')).items).toEqual([])
  expect(await write(player,{...share(1,14,id(13)),linkUpdatedAt:'2026-11-19T12:00:00Z'})).toBe(200)
  await db.exec('update coach_player_links set player_user_id=null')
  expect((await history()).shares[0].active).toBe(false)
  await expect(history(coach,'student-one')).rejects.toThrow()
  await db.query('update coach_player_links set player_user_id=$1',[other])
  expect((await history(coach,'student-one')).items).toEqual([])
})
it('pages all history without duplicates and keeps an older imported assessment out of the current position',async()=>{
  let expected:string|null=null
  for(let n=1;n<=28;n++){expect(await write(player,save(n,expected))).toBe(200);expected=id(n)}
  expect(await write(player,save(29,expected,'2026-10-01'))).toBe(200)
  const first=await history(),second=await history(player,null,first.next)
  expect(first.items).toHaveLength(25);expect(second.items).toHaveLength(4)
  expect(new Set([...first.items,...second.items].map(item=>item.id)).size).toBe(29)
  expect(first.head?.id).toBe(id(28));expect(second.head?.id).toBe(id(28));expect(second.next).toBeNull()
  expect(second.items.at(-1)?.id).toBe(id(29))
})
it('deletes one assessment and its shares, supports a lost delete reply, and cascades private data on account erasure',async()=>{
  await write(player,save(1));await write(player,share(1));await write(other,save(2))
  expect(await write(other,{kind:'delete',id:id(1)})).toBe(200)
  expect((await history()).items).toHaveLength(1)
  expect(await write(player,{kind:'delete',id:id(1)})).toBe(200)
  expect(await write(player,{kind:'delete',id:id(1)})).toBe(200)
  expect((await history()).shares).toEqual([])
  await write(player,save(3));await write(player,share(3))
  await db.exec('delete from coach_player_links')
  await db.query('delete from auth.users where id=$1',[player])
  expect((await db.query('select owner_id from private.tiq_self_assessments')).rows).toEqual([{owner_id:other}])
  expect((await db.query('select * from private.tiq_self_assessment_shares')).rows).toEqual([])
})
it('validates database answers and grants RPC access only to the service role, with no direct table access',async()=>{
  expect(await write(player,{...save(1),answers:{...answers,serve:4}})).toBe(400)
  expect(await write(player,{...save(1),answers:{...answers,'singles-build':2}})).toBe(400)
  expect(await write(player,{...save(1),answers:{...answers,score:10}})).toBe(400)
  const rows=(await db.query<{allowed:boolean;readable:boolean}>(`select
    has_function_privilege('service_role','public.native_tiq_assessment_history(uuid,jsonb,text)','execute') allowed,
    has_table_privilege('service_role','private.tiq_self_assessments','select') readable`)).rows
  expect(rows).toEqual([{allowed:true,readable:false}])
  expect((await db.query(`select has_function_privilege('anon','public.native_tiq_assessment_history(uuid,jsonb,text)','execute') allowed,
    has_function_privilege('authenticated','public.write_native_tiq_assessment(uuid,jsonb)','execute') writable`)).rows).toEqual([{allowed:false,writable:false}])
})
