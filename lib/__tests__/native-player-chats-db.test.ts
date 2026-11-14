import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { hittingPlanStart } from '../hitting-plan'
import { readCalendarChatHits, readChatHit } from '../chat-hit-contract'

const id = (value: number) => '33333333-3333-4333-8333-' + String(value).padStart(12, '0')
const [owner, contact, guest, stranger, unverified, group, post, groupPost] = Array.from({length: 8}, (_, i) => id(i + 1))
const contactToken = 'a'.repeat(64)
const groupToken = 'b'.repeat(64)

it('keeps contacts consensual and player chats private while delivering one notice and signal per message', async () => {
  const db = new PGlite()
  try {
    await db.exec(await readFile('lib/__tests__/fixtures/account-erasure-audited-schema.sql','utf8'))
    await db.exec(`
      create schema private;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      create table public.account_deletion_requests(account_id uuid,status text);
      alter table auth.users add column raw_user_meta_data jsonb;
      alter table public.internal_conversation_participants add unique(conversation_id,profile_id);
      alter table public.team_room_member_removals add unique(conversation_id,profile_id);
      alter table public.team_chat_blocks add unique(owner_user_id,blocked_user_id);
      alter table public.team_chat_reports add unique(reporter_user_id,message_id);
      alter table public.internal_conversations enable row level security;
      alter table public.internal_conversation_participants enable row level security;
      alter table public.internal_messages enable row level security;
      alter table public.team_chat_signals enable row level security;
      create policy legacy_messages on public.internal_messages for all to authenticated using (true) with check (true);
      create policy legacy_participants on public.internal_conversation_participants for all to authenticated using (true) with check (true);
      create view public.native_first_party_updates as
        select id,recipient_profile_id,notification_type,title,body,href,conversation_id,schedule_event_id,read_at,created_at
        from public.internal_notifications where false;
      grant usage on schema private,auth to authenticated;
      grant select on public.native_first_party_updates, public.internal_notifications, public.team_chat_signals to authenticated;
      grant select,insert on public.internal_messages,public.internal_conversation_participants to authenticated;
    `)
    await db.exec(await readFile('supabase/migrations/20261113001100_native_player_chats.sql','utf8'))
    await db.exec(await readFile('supabase/migrations/20261113001200_native_group_practices.sql','utf8'))
    for (const [user,name] of [[owner,'Avery'],[contact,'Cam'],[guest,'Jamie'],[stranger,'Riley'],[unverified,'New player']]) {
      await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)',[
        user,user+'@example.test',user===unverified?null:new Date(),JSON.stringify({first_name:name}),
      ])
      if (user !== guest) await db.query('insert into public.profiles(id,email,message_display_name) values($1,$2,$3)',[user,user+'@example.test',name])
    }
    const action = async (user:string, op:string, {room=null,request=null,target=null,members=null,text=null,token=null}:{
      room?:string|null;request?:string|null;target?:string|null;members?:string[]|null;text?:string|null;token?:string|null
    } = {}) => (await db.query<{value:Record<string,unknown>}>(
      'select public.native_player_chats_action($1,$2,$3,$4,$5,$6,$7,$8) as value',
      [user,op,room,request,target,members,text,token])).rows[0].value
    const read = async (user:string, room:string|null = null) => (await db.query<{value:unknown}>(
      'select public.native_player_chats_read($1,$2,null,null) as value',[user,room])).rows[0].value
    async function asUser(user:string, check:()=>Promise<void>) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user])
      await db.exec('set role authenticated')
      try { await check() } finally { await db.exec('reset role') }
    }

    expect(await action(stranger,'direct',{target:owner})).toEqual({code:'forbidden'})
    expect(await action(owner,'invite',{token:contactToken})).toMatchObject({code:'ok'})
    expect(await action(unverified,'join',{token:contactToken})).toEqual({code:'forbidden'})
    expect(await action(contact,'preview',{token:contactToken})).toEqual({code:'ok',group:false,title:'Avery'})
    expect(await action(contact,'join',{token:contactToken})).toEqual({code:'ok',contact:owner})
    expect(await action(stranger,'join',{token:contactToken})).toEqual({code:'unavailable'})
    expect(await read(owner)).toEqual({code:'ok',contacts:[{id:contact,name:'Cam'}],rooms:[]})
    expect(await read(contact)).toEqual({code:'ok',contacts:[{id:owner,name:'Avery'}],rooms:[]})
    const {roomId} = await action(owner,'direct',{target:contact})
    const direct = String(roomId)
    expect(await action(contact,'direct',{target:owner})).toEqual({code:'ok',roomId:direct})
    await db.exec(await readFile('supabase/migrations/20261114000300_native_direct_chat_hits.sql','utf8'))
    const hit = id(60), replacement = id(61)
    const playDate = new Date(Date.now()+3*86400000).toISOString().slice(0,10)
    const starts = hittingPlanStart({date:playDate,time:'18:00'})!.toISOString()
    const writeHit = async (user:string, operation:string, event=hit, response:string|null=null, room=direct) =>
      (await db.query<{value:{code:string}}>(
        'select public.native_write_chat_hit($1,$2,$3,$4,$5,$6,$7,$8,$9) value',
        [user,room,event,operation,'vetta-west',playDate,'18:00',starts,response])).rows[0].value.code
    const readHit = async (user:string) => (await db.query<{value:unknown}>(
      'select public.native_chat_hit_for_room($1,$2) value',[user,direct])).rows[0].value
    const hitsOnCalendar = async (user:string) => readCalendarChatHits((await db.query<{value:unknown}>(
      'select public.native_chat_hits_for_calendar($1,$2,$2) value',[user,playDate])).rows[0].value,playDate,playDate)
    expect(await writeHit(stranger,'hit_propose')).toBe('forbidden')
    expect(await writeHit(owner,'hit_propose')).toBe('ok')
    expect(await writeHit(owner,'hit_propose')).toBe('ok')
    expect(await writeHit(contact,'hit_propose',replacement)).toBe('hit_stale')
    expect(readChatHit(await readHit(contact))).toMatchObject({id:hit,status:'proposed',proposedBy:owner})
    expect(await readHit(stranger)).toBeNull()
    expect(await hitsOnCalendar(owner)).toEqual([])
    expect(await hitsOnCalendar(contact)).toEqual([])
    expect(await writeHit(owner,'hit_reply',hit,'accepted')).toBe('forbidden')
    await asUser(contact,async ()=>{
      expect((await db.query("select title from public.native_first_party_updates where notification_type='schedule'")).rows)
        .toEqual([{title:'New hitting plan'}])
      await expect(db.query('select public.native_chat_hit_for_room($1,$2)',[contact,direct])).rejects.toMatchObject({code:'42501'})
    })
    expect(await writeHit(contact,'hit_reply',hit,'accepted')).toBe('ok')
    expect(await writeHit(contact,'hit_reply',hit,'accepted')).toBe('ok')
    expect(await hitsOnCalendar(owner)).toMatchObject([{id:hit,partner:'Cam',startsAt:expect.any(String)}])
    expect(await hitsOnCalendar(contact)).toMatchObject([{id:hit,partner:'Avery'}])
    expect(await hitsOnCalendar(stranger)).toEqual([])
    await asUser(owner,async ()=>{
      expect((await db.query("select title from public.native_first_party_updates where notification_type='schedule'")).rows)
        .toEqual([{title:'Hitting plan accepted'}])
    })
    expect(await writeHit(owner,'hit_cancel')).toBe('ok')
    expect(await writeHit(contact,'hit_reply',hit,'accepted')).toBe('hit_stale')
    expect(await hitsOnCalendar(owner)).toEqual([])
    expect(await hitsOnCalendar(contact)).toEqual([])
    expect(readChatHit(await readHit(contact))).toMatchObject({id:hit,status:'cancelled'})
    expect(await writeHit(owner,'hit_propose',replacement)).toBe('ok')
    expect(await writeHit(contact,'hit_reply',replacement,'declined')).toBe('ok')
    expect(readChatHit(await readHit(owner))).toMatchObject({id:replacement,status:'declined'})
    // Remove the fixture hits before running the pre-existing chat notice assertions.
    await db.query('delete from private.native_chat_hits where room_id=$1',[direct])

    const send = {room:direct,request:post,text:'Want to hit on Friday?'}
    expect(await action(owner,'send',send)).toEqual({code:'ok',messageId:post})
    expect(await action(owner,'send',send)).toEqual({code:'ok',messageId:post})
    expect(await action(owner,'send',{...send,text:'Changed text'})).toEqual({code:'invalid'})
    expect(await read(stranger,direct)).toEqual({code:'forbidden'})
    expect(await read(contact,direct)).toMatchObject({code:'ok',room:{title:'Avery',messages:[{id:post,body:send.text}]}})
    expect(await read(contact)).toMatchObject({rooms:[{id:direct,unread:true}]})
    expect(await action(contact,'read',{room:direct,request:post})).toEqual({code:'ok'})
    expect(await read(contact)).toMatchObject({rooms:[{id:direct,unread:false}]})
    await asUser(contact,async ()=>{
      expect((await db.query('select href from public.native_first_party_updates')).rows).toEqual([{href:'/chats?room='+direct}])
      expect((await db.query('select conversation_id from public.team_chat_signals')).rows).toEqual([{conversation_id:direct}])
      expect((await db.query('select id from public.internal_messages')).rows).toEqual([])
      await expect(db.query('select public.native_player_chats_read($1,$2,null,null)',[owner,direct])).rejects.toMatchObject({code:'42501'})
    })
    await asUser(stranger,async ()=>{
      expect((await db.query('select * from public.team_chat_signals')).rows).toEqual([])
      await expect(db.query('insert into public.internal_conversation_participants(conversation_id,profile_id) values($1,$2)',[direct,stranger])).rejects.toMatchObject({code:'42501'})
    })
    expect(await action(contact,'report',{room:direct,request:post,text:'spam'})).toEqual({code:'ok'})
    expect(await action(contact,'block',{room:direct,target:owner})).toEqual({code:'ok'})
    expect(await action(owner,'send',{...send,request:id(99)})).toEqual({code:'forbidden'})
    await asUser(contact,async ()=>{
      expect((await db.query('select href from public.native_first_party_updates')).rows).toEqual([])
      expect((await db.query('select * from public.team_chat_signals')).rows).toEqual([])
    })

    expect(await action(owner,'group',{request:group,text:'Friday practice',members:[stranger]})).toEqual({code:'forbidden'})
    expect(await action(owner,'group',{request:group,text:'Friday practice',members:[]})).toEqual({code:'ok',roomId:group})
    expect(await writeHit(owner,'hit_propose',id(62),null,group)).toBe('forbidden')
    expect(await action(owner,'invite',{room:group,token:groupToken})).toMatchObject({code:'ok'})
    expect(await read(guest)).toEqual({code:'ok',contacts:[],rooms:[]})
    expect(await action(guest,'preview',{token:groupToken})).toEqual({code:'ok',group:true,title:'Friday practice'})
    expect(await read(guest,group)).toEqual({code:'forbidden'})
    expect(await action(guest,'join',{token:groupToken})).toEqual({code:'ok',roomId:group})
    expect(await action(stranger,'join',{token:groupToken})).toEqual({code:'ok',roomId:group})
    const practice = id(41)
    const startsAt = new Date(Date.now()+86400000).toISOString()
    const changePractice = async (user:string, op:string, reply:string|null = null, room=group) =>
      (await db.query<{value:unknown}>('select native_group_practice_action($1,$2,$3,$4,$5,$6,$7,$8) as value',
        [user,room,practice,op,startsAt,'Court 2',2,reply])).rows[0].value
    const practiceRoom = async (user:string) =>
      (await db.query<{value:unknown}>('select native_player_chat_room_with_practice($1,$2,null,null) as value',
        [user,group])).rows[0].value
    expect(await changePractice(guest,'practice_create')).toEqual({code:'forbidden'})
    expect(await changePractice(owner,'practice_create',null,direct)).toEqual({code:'forbidden'})
    expect(await changePractice(owner,'practice_create')).toEqual({code:'ok'})
    expect(await changePractice(owner,'practice_create')).toEqual({code:'ok'})
    expect(await changePractice(guest,'practice_reply','in')).toEqual({code:'ok'})
    expect(await changePractice(stranger,'practice_reply','in')).toEqual({code:'ok'})
    expect(await changePractice(owner,'practice_reply','in')).toEqual({code:'full'})
    expect(await practiceRoom(guest)).toMatchObject({room:{practice:{id:practice,mine:'in',inCount:2,
      players:[{name:'Jamie'},{name:'Riley'}]}}})
    expect(await changePractice(guest,'practice_reply','out')).toEqual({code:'ok'})
    expect(await changePractice(owner,'practice_reply','in')).toEqual({code:'ok'})
    expect(await action(guest,'invite',{room:group,token:'c'.repeat(64)})).toEqual({code:'forbidden'})
    expect(await action(guest,'send',{room:group,request:groupPost,text:'Court 2 at 6 pm'})).toEqual({code:'ok',messageId:groupPost})
    expect(await read(stranger,group)).toMatchObject({room:{title:'Friday practice',messages:[{id:groupPost,author:guest,name:'Jamie'}]}})
    expect(await action(owner,'remove',{room:group,target:stranger})).toEqual({code:'ok'})
    expect(await practiceRoom(owner)).toMatchObject({room:{practice:{mine:'in',inCount:1,players:[{name:'Avery'}]}}})
    expect(await practiceRoom(stranger)).toEqual({code:'forbidden'})
    expect(await changePractice(stranger,'practice_reply','in')).toEqual({code:'forbidden'})
    await db.exec(await readFile('supabase/migrations/20261114000100_native_group_practice_edit.sql','utf8'))
    const practiceRevision = async () => (await db.query<{revision:string}>(
      'select revision from private.native_group_practices where id=$1',[practice])).rows[0].revision
    const revision = await practiceRevision()
    const newTime = new Date(Date.now()+172800000).toISOString()
    const edit = async (user:string, version=revision, request=id(50), court='Court 4', capacity=4, time=newTime) =>
      (await db.query<{value:unknown}>('select native_edit_group_practice($1,$2,$3,$4,$5,$6,$7,$8) as value',
        [user,group,practice,version,request,time,court,capacity])).rows[0].value
    const scheduleNotices = async (user:string) => {
      let rows:unknown[] = []
      await asUser(user,async ()=>{
        rows = (await db.query("select title,href from public.native_first_party_updates where notification_type='schedule'")).rows
      })
      return rows
    }
    expect(await changePractice(guest,'practice_reply','in')).toEqual({code:'ok'})
    expect(await edit(guest)).toEqual({code:'forbidden'})
    expect(await edit(owner)).toEqual({code:'ok'})
    expect(await edit(owner)).toEqual({code:'ok'})
    expect(await edit(owner,revision,id(50),'Different court')).toEqual({code:'stale'})
    expect(await edit(owner,revision,id(51))).toEqual({code:'stale'})
    const secondRevision = await practiceRevision()
    expect(secondRevision).not.toBe(revision)
    expect(await practiceRoom(guest)).toMatchObject({room:{practice:{id:practice,revision:secondRevision,court:'Court 4',mine:'in',inCount:2}}})
    const notice = {title:'Group practice changed',href:'/chats?room='+group}
    expect(await scheduleNotices(guest)).toEqual([notice])
    expect(await scheduleNotices(stranger)).toEqual([])
    expect(await scheduleNotices(owner)).toEqual([])
    expect(await edit(owner,secondRevision,id(52),'Court 5')).toEqual({code:'ok'})
    expect(await scheduleNotices(guest)).toEqual([notice])
    await db.query("update public.internal_notifications set read_at=now() where notification_type='schedule'")
    await db.query('insert into public.internal_notification_preferences(profile_id,schedule_alerts_enabled) values($1,false)',[guest])
    expect(await edit(owner,await practiceRevision(),id(53),'Court 6')).toEqual({code:'ok'})
    expect(await scheduleNotices(guest)).toEqual([notice])
    expect(await read(stranger,group)).toEqual({code:'forbidden'})
    expect(await action(stranger,'join',{token:groupToken})).toEqual({code:'unavailable'})
    await asUser(stranger,async ()=>{
      expect((await db.query('select href from public.native_first_party_updates')).rows).toEqual([])
      expect((await db.query('select * from public.team_chat_signals')).rows).toEqual([])
    })
    expect(await action(owner,'revoke_links',{room:group})).toEqual({code:'ok'})
    expect(await action(guest,'preview',{token:groupToken})).toEqual({code:'unavailable'})
    expect(await changePractice(guest,'practice_cancel')).toEqual({code:'forbidden'})
    expect(await changePractice(owner,'practice_cancel')).toEqual({code:'ok'})
    expect(await practiceRoom(owner)).toMatchObject({room:{practice:null}})
    expect(await scheduleNotices(guest)).toEqual([])
    expect(await action(owner,'leave',{room:group})).toEqual({code:'ok'})
    expect(await read(guest,group)).toEqual({code:'forbidden'})
  } finally { await db.close() }
},20000)
