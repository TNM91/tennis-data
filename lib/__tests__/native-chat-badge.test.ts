import {afterEach,expect,it,vi} from 'vitest'
import {createClient} from '@supabase/supabase-js'
vi.mock('server-only',()=>({}))
import {nativeChatBadgeCounts} from '../native-chat-badge'
const owner='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222'
afterEach(()=>vi.restoreAllMocks())
function fixture(data:unknown,status=200){
 const calls:{url:URL;method:string;body:unknown;signal:AbortSignal|null|undefined}[]=[]
 const client=createClient('https://synthetic.invalid','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(raw,init)=>{
  calls.push({url:new URL(String(raw)),method:init?.method||'GET',body:JSON.parse(String(init?.body)),signal:init?.signal})
  return Response.json(data,{status})
 }}})
 return {client,calls}
}
it('loads one deduplicated recipient batch, with no stored counter, extra fields or retry',async()=>{
 const f=fixture([{profile_id:owner,unread:7},{profile_id:peer,unread:0}])
 expect(await nativeChatBadgeCounts(f.client,[owner,peer,owner])).toEqual(new Map([[owner,7],[peer,0]]))
 expect(f.calls).toHaveLength(1);expect(f.calls[0]).toMatchObject({method:'POST',body:{p_owners:[owner,peer]}})
 expect(f.calls[0].url.pathname).toBe('/rest/v1/rpc/native_chat_badge_counts');expect(f.calls[0].signal).toBeTruthy()
})
it('never requests a count for an empty, malformed or over-limit recipient list',async()=>{
 const f=fixture([])
 for(const owners of [[],['foreign'],Array.from({length:101},(_,i)=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0'))])expect((await nativeChatBadgeCounts(f.client,owners)).size).toBe(0)
 expect(f.calls).toHaveLength(0)
})
it('keeps missing recipients unknown and accepts an explicit zero or capped total',async()=>{
 const f=fixture([{profile_id:owner,unread:100}]),counts=await nativeChatBadgeCounts(f.client,[owner,peer])
 expect(counts.get(owner)).toBe(100);expect(counts.has(peer)).toBe(false)
 expect((await nativeChatBadgeCounts(fixture([{profile_id:owner,unread:0}]).client,[owner])).get(owner)).toBe(0)
})
it('rejects duplicate, foreign, malformed and unbounded results without turning an outage into zero',async()=>{
 vi.spyOn(console,'warn').mockImplementation(()=>{})
 for(const rows of [[{profile_id:owner,unread:1},{profile_id:owner,unread:1}],[{profile_id:peer,unread:1}],[{profile_id:owner,unread:null}],[{profile_id:owner,unread:-1}],[{profile_id:owner,unread:101}],[{profile_id:owner,unread:1.5}],{}]){
  const f=fixture(rows);expect((await nativeChatBadgeCounts(f.client,[owner])).size).toBe(0);expect(f.calls).toHaveLength(1)
 }
})
it('does not retry a failed aggregate and leaves ordinary alert delivery independent',async()=>{
 vi.spyOn(console,'warn').mockImplementation(()=>{});const f=fixture({message:'Synthetic unavailable'},503)
 expect((await nativeChatBadgeCounts(f.client,[owner])).size).toBe(0);expect(f.calls).toHaveLength(1)
})
