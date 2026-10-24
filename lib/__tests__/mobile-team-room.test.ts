import {describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadTeamRoom,loadTeamChatUpdate,parseTeamData} from '../../mobile/src/team-room-data'
import {teamConversationHtml,teamMatchDayHtml} from '../../mobile/src/team-room-view'
const scope={teamName:'North Aces',leagueName:'City League',flight:'4.0'}
const raw=()=>({ok:true,teams:[scope],room:{...scope,id:'room-1',subject:'Team Room',muted:false,activeCardId:'message-0',nextScheduledMatch:{matchDate:'2026-10-29',opponent:'South',matchTime:'18:00',facility:'Club'},members:[{name:'<Alex>',roles:['captain']}],messages:Array.from({length:90},(_,i)=>({id:'message-'+i,senderName:'<Alex>',body:'<script>private</script>',kind:'message',createdAt:'2026-10-20T18:00:00Z',deletedAt:i===89?'2026-10-21':'',isMine:false,attachment:i===89?{url:'https://untrusted.invalid'}:null,card:i===0?{matchDate:'2026-10-29',opponent:'South',state:'active',lineup:[{label:'D1',players:['<Alex>','Jordan']}]}:null}))}})
describe('native linked team room',()=>{
 it('bounds displayed history while retaining an older active card for Match day',()=>{
  const data=parseTeamData(raw());expect(data.room?.messages).toHaveLength(75);expect(data.room?.messages[0].id).toBe('message-15');expect(data.room?.activeCard?.id).toBe('message-0')
 })
 it('escapes private text and never renders removed bodies or attachment URLs',()=>{
  const room=parseTeamData(raw()).room!,markup=teamConversationHtml(room)
  expect(markup).not.toContain('<script>');expect(markup).not.toContain('https://untrusted.invalid');expect(markup).toContain('&lt;script&gt;');expect(markup).toContain('Message removed.')
  expect(room.messages.at(-1)?.body).toBe('Message removed.')
  const plan=teamMatchDayHtml(room);expect(plan).toContain('&lt;Alex&gt; &amp; Jordan');expect(plan).toContain('check captain announcements')
 })
 it('supports no-team state but fails closed for malformed or unsuccessful room responses',()=>{
  expect(parseTeamData({ok:true,teams:[],room:null})).toEqual({teams:[],room:null})
  expect(()=>parseTeamData({ok:false,teams:[],room:null})).toThrow();expect(()=>parseTeamData({ok:true,teams:[],room:{id:'x'}})).toThrow()
 })
 it('uses the current owner token only on the fixed scoped HTTPS endpoint',async()=>{
  const client={auth:{getSession:vi.fn().mockResolvedValue({data:{session:{user:{id:'owner'},access_token:'test-token'}},error:null})}} as unknown as SupabaseClient
  const send=vi.fn().mockResolvedValue({status:200,data:raw()})
  await loadTeamRoom(client,'owner',()=>true,scope,send)
  const options=send.mock.calls[0][0],url=new URL(options.url)
  expect(url.origin).toBe('https://www.tenaceiq.com');expect(url.pathname).toBe('/api/team-rooms');expect(url.searchParams.get('team')).toBe(scope.teamName);expect(options.headers).toEqual({Authorization:'Bearer test-token'});expect(options.disableRedirects).toBe(true);expect(options.readTimeout).toBe(12000)
  send.mockClear();await expect(loadTeamRoom(client,'other',()=>true,scope,send)).rejects.toThrow('Sign in again');expect(send).not.toHaveBeenCalled()
  await expect(loadTeamRoom(client,'owner',()=>false,scope,send)).rejects.toThrow('Sign in again');expect(send).not.toHaveBeenCalled()
 })
 it('rejects a response for another selected team instead of exposing it in this view',async()=>{
  const client={auth:{getSession:vi.fn().mockResolvedValue({data:{session:{user:{id:'owner'},access_token:'test-token'}},error:null})}} as unknown as SupabaseClient
  const send=vi.fn().mockResolvedValue({status:200,data:raw()})
  await expect(loadTeamRoom(client,'owner',()=>true,{...scope,teamName:'Other'},send)).rejects.toThrow('scope mismatch')
  send.mockResolvedValue({status:403,data:raw()});await expect(loadTeamRoom(client,'owner',()=>true,scope,send)).rejects.toThrow('access is unavailable')
 })
 it('loads a bounded text update only for the captured room, with no read acknowledgement in the GET',async()=>{
  const client={auth:{getSession:vi.fn().mockResolvedValue({data:{session:{user:{id:'owner'},access_token:'test-token'}},error:null})}} as unknown as SupabaseClient
  const room=raw().room,send=vi.fn().mockResolvedValue({status:200,data:{ok:true,chatUpdate:true,room:{id:room.id,blockedUserIds:[],messages:room.messages,lastReadAt:'2026-10-01T00:00:00Z'}}})
  const update=await loadTeamChatUpdate(client,'owner',()=>true,scope,room.id,send)
  expect(update.messages).toHaveLength(75);expect(new URL(send.mock.calls[0][0].url).pathname).toBe('/api/team-rooms/chat')
  expect(send.mock.calls[0][0].disableRedirects).toBe(true)
  await expect(loadTeamChatUpdate(client,'owner',()=>true,scope,'other-room',send)).rejects.toThrow('unavailable')
  send.mockResolvedValue({status:403});await expect(loadTeamChatUpdate(client,'owner',()=>true,scope,room.id,send)).rejects.toThrow('access is unavailable')
 })

})

describe('older conversation transport',()=>{
 const client={auth:{getSession:vi.fn().mockResolvedValue({data:{session:{user:{id:'owner'},access_token:'test-token'}},error:null})}} as unknown as SupabaseClient
 const before='2026-10-24T08:00:00.123456+00:00|1959be10-0000-4000-8000-000000000075'
 it('requests the exact page on the read-only endpoint and rejects rollback, wrong page, room, and malformed cursor responses',async()=>{
  const data={ok:true,chatUpdate:true,beforeCursor:before,nextCursor:'',room:{id:'room-1',blockedUserIds:[],messages:raw().room.messages,lastReadAt:''}}
  const send=vi.fn().mockResolvedValue({status:200,data})
  const page=await loadTeamChatUpdate(client,'owner',()=>true,scope,'room-1',send,before)
  expect(page.messages).toHaveLength(75);expect(page.nextCursor).toBe('');expect(page.beforeCursor).toBe(before)
  const url=new URL(send.mock.calls[0][0].url);expect(url.searchParams.get('before')).toBe(before);expect(url.searchParams.get('team')).toBe(scope.teamName);expect(url.searchParams.get('flight')).toBe('4.0');expect(url.pathname).toBe('/api/team-rooms/chat')
  for(const change of [{beforeCursor:undefined},{beforeCursor:''},{nextCursor:'unsafe'},{room:{...data.room,id:'another-room'}},{chatUpdate:false}]){
   send.mockResolvedValue({status:200,data:{...data,...change}})
   await expect(loadTeamChatUpdate(client,'owner',()=>true,scope,'room-1',send,before)).rejects.toThrow()
  }
  send.mockClear();await expect(loadTeamChatUpdate(client,'owner',()=>true,scope,'room-1',send,'unsafe')).rejects.toThrow();expect(send).not.toHaveBeenCalled()
  await expect(loadTeamChatUpdate(client,'other',()=>true,scope,'room-1',send,before)).rejects.toThrow();expect(send).not.toHaveBeenCalled()
 })
 it('renders navigation without attachment URLs and clearly identifies an older window',()=>{
  const markup=teamConversationHtml(parseTeamData(raw()).room!,true)
  expect(markup).toContain('Earlier messages');expect(markup).toContain('id="chat-earlier"');expect(markup).not.toContain('Latest 75 messages');expect(markup).not.toContain('https://untrusted.invalid')
 })
})
