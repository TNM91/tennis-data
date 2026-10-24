import {describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadTeamRoom,parseTeamData} from '../../mobile/src/team-room-data'
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
})
