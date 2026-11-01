import {expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
vi.mock('server-only',()=>({}))
import {coachConversationId} from '../native-coach-chat-unread'

it('counts accessible unread team and Coach posts in PostgreSQL with server-only grants and no read writes',async()=>{
 const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002',foreign='00000000-0000-4000-8000-000000000003'
 const parent='00000000-0000-4000-8000-000000000100',child='00000000-0000-4000-8000-000000000101',coach=coachConversationId('student-one')
 const before='2026-11-01T12:00:00.123455+00:00',after='2026-11-01T12:00:00.123456+00:00'
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema private;create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
 create table profiles(id uuid primary key);
 create table internal_conversations(id uuid primary key default gen_random_uuid(),conversation_type text check(conversation_type in ('direct','support','league','system','team')),subject text,status text default 'open',created_by_user_id uuid,assigned_admin_user_id uuid,related_entity_type text not null default '',related_entity_id text,metadata jsonb);
 create table internal_conversation_participants(conversation_id uuid,profile_id uuid,participant_role text check(participant_role in ('member','admin','support','coordinator','system')),muted boolean default false,last_read_at timestamptz,primary key(conversation_id,profile_id));
 create table team_profile_links(profile_user_id uuid,team_name text,normalized_team_name text,league_name text,flight text,team_role text,team_roles text[],status text,archived_at timestamptz);
 create table team_room_member_removals(conversation_id uuid,profile_id uuid);
 create table internal_messages(id uuid primary key default gen_random_uuid(),conversation_id uuid,sender_user_id uuid,created_at timestamptz,deleted_at timestamptz);
 create table team_chat_blocks(owner_user_id uuid,blocked_user_id uuid);
 create table team_room_message_reactions(conversation_id uuid,message_id uuid,profile_id uuid,reaction text check(reaction in ('ack','helpful','celebrate')),primary key(message_id,profile_id,reaction));
 create table team_chat_signals(conversation_id uuid primary key,revision bigint default 1,changed_at timestamptz);
 create table coach_player_links(id text primary key,coach_user_id uuid,player_user_id uuid,status text);
 create function private.is_profile_team_member(uuid,text,text,text) returns boolean language sql as $$select false$$;
 grant usage on schema public,private,auth to service_role;grant all on all tables in schema public to service_role;
 insert into profiles values('${owner}'),('${peer}'),('${foreign}');
 insert into internal_conversations(id,conversation_type,created_by_user_id,related_entity_type,related_entity_id,metadata) values('${parent}','team','${owner}','team_room','aces__city__4 0','{"teamName":"Aces","leagueName":"City","flight":"4.0"}');
 insert into internal_conversation_participants values('${parent}','${owner}','coordinator',false,'${before}'),('${parent}','${peer}','member',false,'${before}');
 insert into team_profile_links values('${owner}','Aces','aces','City','4.0','captain',array['captain'],'accepted',null),('${peer}','Aces','aces','City','4.0','player',array['player'],'accepted',null);
 `)
 for(const migration of ['20261027000100_expand_native_chat_reactions.sql','20261027000200_named_team_chat_rooms.sql','20261101000100_native_chat_badge_counts.sql'])await db.exec(readFileSync('supabase/migrations/'+migration,'utf8'))
 const query=async<T=Record<string,unknown>>(sql:string,params:unknown[]=[])=>{await db.exec('set role service_role');try{return (await db.query<T>(sql,params)).rows}finally{await db.exec('reset role')}}
 const counts=async(ids:string[]=[owner])=>query<{profile_id:string;unread:number}>('select * from native_chat_badge_counts($1::uuid[])',[ids])
 await query('select native_team_chat_rooms($1,\'Aces\',\'City\',\'4.0\',\'create\',$2,\'Practice\')',[owner,child])
 await db.exec(`insert into coach_player_links values('student-one','${owner}','${peer}','active');
 insert into internal_conversations(id,conversation_type,related_entity_type,related_entity_id) values('${coach}','direct','coach_student','student-one');
 insert into internal_conversation_participants values('${coach}','${owner}','member',false,'${before}'),('${coach}','${peer}','member',false,'${before}');
 update internal_conversation_participants set last_read_at='${before}' where conversation_id='${child}';
 insert into internal_messages(conversation_id,sender_user_id,created_at,deleted_at) values
 ('${parent}','${peer}','${after}',null),('${parent}','${peer}','${before}',null),('${parent}','${owner}','${after}',null),('${parent}','${peer}','${after}',now()),
 ('${child}','${peer}','${after}',null),('${child}','${peer}','${after}',null),('${coach}','${peer}','${after}',null),('${coach}','${owner}','${after}',null);`)
 expect(await counts()).toEqual([{profile_id:owner,unread:4}])
 const rooms=(await query<{value:{generalUnread:number;rooms:{unread:number}[]}}>('select native_team_chat_rooms($1,\'Aces\',\'City\',\'4.0\',\'list\') value',[owner]))[0].value
 expect(rooms.generalUnread+rooms.rooms.reduce((sum,r)=>sum+r.unread,0)).toBe(3)
 // Duplicate team links and muted rooms must not duplicate or erase the inbox.
 await db.exec(`insert into team_profile_links select * from team_profile_links where profile_user_id='${owner}';update internal_conversation_participants set muted=true where profile_id='${owner}'`)
 expect(await counts()).toEqual([{profile_id:owner,unread:4}]);expect((await counts([owner,peer])).find(row=>row.profile_id===peer)?.unread).toBe(2)
 expect((await db.query<{read:string}>('select last_read_at::text read from internal_conversation_participants where conversation_id=$1 and profile_id=$2',[parent,owner])).rows[0].read).toContain('.123455')
 await db.exec(`insert into team_chat_blocks values('${owner}','${peer}')`);expect(await counts()).toEqual([{profile_id:owner,unread:1}]);await db.exec('delete from team_chat_blocks')
 // Reading General must leave Practice and Coach unread until their own read.
 await db.exec(`update internal_conversation_participants set last_read_at='${after}' where profile_id='${owner}' and conversation_id='${parent}'`)
 expect(await counts()).toEqual([{profile_id:owner,unread:3}])
 await db.exec(`update internal_conversation_participants set last_read_at='${after}' where profile_id='${owner}'`);expect(await counts()).toEqual([{profile_id:owner,unread:0}])
 await db.exec(`update internal_conversation_participants set last_read_at='${before}' where profile_id='${owner}';insert into team_room_member_removals values('${parent}','${owner}')`)
 expect(await counts()).toEqual([{profile_id:owner,unread:1}]);await db.exec('delete from team_room_member_removals')
 await db.exec(`update team_profile_links set archived_at=now() where profile_user_id='${owner}'`);expect(await counts()).toEqual([{profile_id:owner,unread:1}])
 await db.exec(`update coach_player_links set status='paused'`);expect(await counts()).toEqual([{profile_id:owner,unread:0}])
 await db.exec(`update coach_player_links set status='active';delete from internal_conversation_participants where profile_id='${owner}' and conversation_id='${coach}'`)
 expect(await counts()).toEqual([{profile_id:owner,unread:0}])
 await db.exec(`insert into internal_conversation_participants values('${coach}','${owner}','member',false,'${before}');update internal_conversations set status='closed' where id='${coach}'`)
 expect(await counts()).toEqual([{profile_id:owner,unread:0}])
 await db.exec(`update internal_conversations set status='open' where id='${coach}';insert into internal_messages(conversation_id,sender_user_id,created_at) values('${coach}','${foreign}','${after}')`)
 expect(await counts()).toEqual([]);expect(await counts([owner,foreign])).toEqual([{profile_id:foreign,unread:0}])
 await db.exec(`delete from internal_messages where sender_user_id='${foreign}';update team_profile_links set archived_at=null;insert into internal_messages(conversation_id,sender_user_id,created_at) select '${parent}','${peer}','${after}' from generate_series(1,120)`)
 expect(await counts()).toEqual([{profile_id:owner,unread:100}])
 await db.exec(`insert into team_profile_links select '${owner}','Unused '||n,'unused '||n,'City','4.0','player',array['player'],'accepted',null from generate_series(1,50) n`)
 expect(await counts()).toEqual([])
 for(const ids of [[],[owner,owner],[null],Array(101).fill(owner)])await expect(counts(ids as string[])).rejects.toThrow('Invalid badge recipients')
 expect(await counts(['ffffffff-ffff-4fff-8fff-ffffffffffff'])).toEqual([])
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role)
  try{await expect(db.query('select * from public.native_chat_badge_counts($1::uuid[])',[[owner]])).rejects.toThrow('permission denied')}finally{await db.exec('reset role')}
 }
 const grants=(await db.query<{definer:boolean;anonymous:boolean;member:boolean;server:boolean}>(`select p.prosecdef definer,has_function_privilege('anon',p.oid,'execute') anonymous,has_function_privilege('authenticated',p.oid,'execute') member,has_function_privilege('service_role',p.oid,'execute') server from pg_proc p where p.proname='native_chat_badge_counts'`)).rows[0]
 expect(grants).toEqual({definer:false,anonymous:false,member:false,server:true})
 }finally{await db.close()}
},30000)
