import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest'
import {readTeamLineupChange,readTeamLineupReplyChange} from '../team-match-lineup-contract'
import {readTeamMatchReplies} from '../team-match-replies-contract'

const captain='11111111-1111-4111-8111-111111111111',player='22222222-2222-4222-8222-222222222222',
 room='33333333-3333-4333-8333-333333333333',revision='44444444-4444-4444-8444-444444444444',
 a='55555555-5555-4555-8555-555555555555',b='66666666-6666-4666-8666-666666666666',c='77777777-7777-4777-8777-777777777777'
const courts=[{format:'singles' as const,players:[player]}]
let db:PGlite
async function save(version=a,expected:string|null=null,publish:boolean|null=false,who=captain){
 return (await db.query<{r:{status:number;lineup:unknown;sharedLineup:{version:string}|null}}>(
  'select save_native_team_match_plan($1,$2,\'Aces\',\'City\',\'4.0\',$3,$4,$5,$6,true,null,$7) r',
  [who,room,revision,expected,version,courts,publish])).rows[0].r
}
async function confirm(version=a,operation=b,expected:string|null=null,choice='confirmed',who=player){
 return (await db.query<{r:number}>("select reply_to_native_team_lineup($1,$2,'Aces','City','4.0',$3,$4,$5,$6,$7) r",
  [who,room,revision,version,expected,operation,choice])).rows[0].r
}
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(id uuid primary key,message_display_name text);
 create table internal_conversations(id uuid primary key,status text,related_entity_type text,related_entity_id text);
 create table internal_conversation_participants(conversation_id uuid,profile_id uuid,primary key(conversation_id,profile_id));
 create table team_profile_links(profile_user_id uuid,team_name text,league_name text,flight text,status text,archived_at timestamptz,source_type text,team_roles text[],team_role text);
 create table team_room_member_removals(conversation_id uuid,profile_id uuid);`)
 for(const file of ['20261110000700_native_team_next_fixtures.sql','20261118000100_native_lineup_tactics.sql'])await db.exec(readFileSync('supabase/migrations/'+file,'utf8'))
 const migration=readFileSync('supabase/migrations/20261119000200_native_lineup_publication.sql','utf8')
 // The complete, guarded catalog migration is covered against the audited schema.
 await db.exec(migration.slice(0,migration.indexOf('do $catalog$'))+'\ncommit;')
},30000)
beforeEach(async()=>{
 await db.exec(`truncate native_team_next_fixtures,profiles,internal_conversations,internal_conversation_participants,team_profile_links,team_room_member_removals cascade;
 insert into profiles values('${captain}','Captain'),('${player}','<Alex>');
 insert into internal_conversations values('${room}','open','team_room','aces__city__4 0');
 insert into internal_conversation_participants values('${room}','${captain}'),('${room}','${player}');
 insert into team_profile_links values('${captain}','Aces','City','4.0','accepted',null,'manual_invite',array['captain'],'captain'),
 ('${player}','Aces','City','4.0','accepted',null,'manual_invite',array['player'],'player');
 insert into native_team_next_fixtures(room_id,revision,fixture) values('${room}','${revision}','{"date":"2030-06-09","opponent":"Topspin Club"}');`)
})
afterAll(async()=>{await db?.close()})

describe('published first-party lineups',()=>{
 it('keeps drafts private and permits publication without a board; retries bind the publication intent',async()=>{
  expect((await save()).sharedLineup).toBeNull()
  expect((await save(b,a,true)).sharedLineup).toMatchObject({version:b})
  expect((await save(c,b,false)).sharedLineup).toMatchObject({version:b})
  expect((await save(c,b,false)).status).toBe(200)
  expect((await save(c,b,true)).status).toBe(409)
  expect((await save(revision,c,null)).sharedLineup).toMatchObject({version:b})
 })
 it('pins confirmations to a published version and exact player with safe replay and correction',async()=>{
  expect(await confirm()).toBe(409)
  await save(a,null,true)
  expect(await confirm(a,b,null,'confirmed',captain)).toBe(409)
  expect(await confirm()).toBe(200)
  expect(await confirm()).toBe(200)
  expect(await confirm(a,b,null,'needs_change')).toBe(409)
  expect(await confirm(a,c,null,'needs_change')).toBe(409)
  expect(await confirm(a,c,b,'needs_change')).toBe(200)
  expect((await db.query('select choice from native_team_lineup_replies')).rows).toEqual([{choice:'needs_change'}])
 })
 it('preserves confirmations during private edits and clears them on publication or rescheduling',async()=>{
  await save(a,null,true);await confirm()
  await save(b,a,false)
  expect((await db.query('select * from native_team_lineup_replies')).rows).toHaveLength(1)
  await save(c,b,true)
  expect((await db.query('select * from native_team_lineup_replies')).rows).toHaveLength(0)
  expect(await confirm(a)).toBe(409)
  expect(await confirm(c)).toBe(200)
  await db.query('update native_team_next_fixtures set revision=$1 where room_id=$2',[a,room])
  expect((await db.query('select * from native_team_lineup_replies')).rows).toHaveLength(0)
  expect((await db.query('select published_lineup from native_team_next_fixtures')).rows[0]).not.toEqual({published_lineup:null})
  await db.query(`update native_team_next_fixtures set fixture='{"date":"2030-07-01","opponent":"Other Club"}' where room_id=$1`,[room])
  expect((await db.query('select published_lineup from native_team_next_fixtures')).rows).toEqual([{published_lineup:null}])
 })
 it('denies removed members, closed rooms and unavailable players before a confirmation write',async()=>{
  await save(a,null,true)
  await db.query('insert into team_room_member_removals values($1,$2)',[room,player])
  expect(await confirm()).toBe(403)
  await db.exec('truncate team_room_member_removals')
  await db.query('insert into native_team_fixture_replies values($1,$2,$3,$4,\'out\')',[room,player,revision,c])
  expect(await confirm()).toBe(409)
  expect(await confirm(a,b,null,'needs_change')).toBe(200)
  await db.query("update internal_conversations set status='closed'")
  expect(await confirm(a,c,b,'confirmed')).toBe(403)
 })
 it('does not partially publish after an unavailable player or stale draft conflict',async()=>{
  await save(a,null,true)
  await db.query('insert into native_team_fixture_replies values($1,$2,$3,$4,\'out\')',[room,player,revision,c])
  expect((await save(b,a,true)).status).toBe(409)
  expect((await db.query("select lineup->>'version' draft,published_lineup->>'version' published from native_team_next_fixtures")).rows).toEqual([{draft:a,published:a}])
 })
 it('requires a fresh assignment response after a player changes availability',async()=>{
  await db.query('insert into native_team_fixture_replies values($1,$2,$3,$4,\'in\')',[room,player,revision,c])
  await save(a,null,true);await confirm()
  await db.query("update native_team_fixture_replies set choice='maybe' where room_id=$1 and profile_id=$2",[room,player])
  expect((await db.query('select * from native_team_lineup_replies')).rows).toEqual([])
  expect(await confirm(a,c,null)).toBe(200)
 })
 it('erases identity snapshots and replies while keeping service-only grants',async()=>{
  await save(a,null,true);await confirm()
  await db.query('delete from profiles where id=$1',[player])
  expect((await db.query('select lineup,published_lineup from native_team_next_fixtures')).rows).toEqual([{lineup:null,published_lineup:null}])
  expect((await db.query('select * from native_team_lineup_replies')).rows).toEqual([])
  expect((await db.query("select has_table_privilege('authenticated','native_team_lineup_replies','select') allowed")).rows).toEqual([{allowed:false}])
  expect((await db.query("select has_function_privilege('anon','reply_to_native_team_lineup(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,text)','execute') allowed")).rows).toEqual([{allowed:false}])
 })
 it('rejects malformed publication and stale confirmation payloads',()=>{
  expect(readTeamLineupChange({revision,expected:null,version:a,courts,publish:'yes'})).toBeNull()
  expect(readTeamLineupReplyChange({revision,expected:null,id:b,version:a,choice:'read'})).toBeNull()
  const shared={version:a,courts,names:{[player]:'<Alex>'}}
  expect(readTeamMatchReplies({own:null,sharedLineup:shared,lineupReply:{id:b,version:a,choice:'confirmed'}}).sharedLineup).toEqual(shared)
  expect(()=>readTeamMatchReplies({own:null,sharedLineup:shared,lineupReply:{id:b,version:c,choice:'confirmed'}})).toThrow()
 })
})
