import {describe,it,expect,vi} from 'vitest'
import {createClient} from '@supabase/supabase-js'
import {parseUpdatePage,updateCursorFilter,loadUpdates,countUnreadUpdates,markUpdatesRead,updateAction,resolveUpdateAction} from '../../mobile/src/updates-data'
import {toInternalNotification} from '../internal-notification-record'
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const id=(n=1)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')
const raw=(n=1)=>({id:id(n),recipient_profile_id:owner,notification_type:'message',title:'Practice update',body:'See you on court.',href:'/tournaments/open-draw',conversation_id:null,schedule_event_id:null,read_at:null,created_at:'2026-10-31T10:00:00.123456+00:00'})
const item=(n=1)=>toInternalNotification(raw(n))!
function client(reply:(request:{url:URL;method:string;body:Record<string,unknown>|null;headers:Headers})=>Response|Promise<Response>){
 const calls:{url:URL;method:string;body:Record<string,unknown>|null;headers:Headers}[]=[]
 const c=createClient('https://updates.example.test','synthetic-anon',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{const r={url:new URL(String(input)),method:init?.method||'GET',body:init?.body?JSON.parse(String(init.body)):null,headers:new Headers(init?.headers)};calls.push(r);return reply(r)}}})
 const session=vi.spyOn(c.auth,'getSession').mockResolvedValue({data:{session:{user:{id:owner},access_token:'account-A-token'}},error:null} as never)
 return {c,calls,session}
}
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}})
describe('owned Updates records and cursors',()=>{
 it('reuses the website projection and preserves a microsecond cursor over 25 rows',()=>{
  const page=parseUpdatePage(Array.from({length:26},(_,i)=>raw(i+1)),owner)
  expect(page.rows).toHaveLength(25);expect(page.more).toBe(true);expect(page.cursor).toEqual({id:id(25),createdAt:raw().created_at})
  expect(updateCursorFilter(page.cursor!)).toContain('created_at.eq.2026-10-31T10:00:00.123456+00:00')
  expect(page.rows[0]).toEqual(item())
 })
 it('rejects foreign, malformed, duplicate and oversized batches before displaying anything',()=>{
  for(const value of [[{...raw(),recipient_profile_id:other}],[raw(),raw()],[{...raw(),created_at:'2026-02-30T10:00:00Z'}],[{...raw(),read_at:'invalid'}],[{...raw(),read_at:42}],[{...raw(),read_at:''}],[{...raw(),body:42}],Array.from({length:27},(_,i)=>raw(i))])expect(()=>parseUpdatePage(value,owner)).toThrow()
  for(const cursor of [{id:'x',createdAt:raw().created_at},{id:id(),createdAt:'x),recipient_profile_id.eq.'+other}])expect(()=>updateCursorFilter(cursor)).toThrow()
  expect(parseUpdatePage([{...raw(),body:'x'.repeat(4100)}],owner).rows[0].body).toHaveLength(4001)
 })
 it('scopes and pins list/count queries, category filters and pagination to the signed-in account',async()=>{
  const h=client(r=>r.method==='HEAD'?new Response(null,{headers:{'Content-Range':'0-0/73'}}):json([raw()]))
  await loadUpdates(h.c,owner,()=>true,{unread:true,category:'other'},{id:id(),createdAt:raw().created_at});expect(await countUnreadUpdates(h.c,owner,()=>true)).toBe(73)
  for(const call of h.calls){expect(call.url.searchParams.get('recipient_profile_id')).toBe('eq.'+owner);expect(call.headers.get('Authorization')).toBe('Bearer account-A-token')}
  expect(h.calls[0].url.searchParams.get('notification_type')).toBe('in.(support,system)');expect(h.calls[0].url.searchParams.get('read_at')).toBe('is.null');expect(h.calls[0].url.searchParams.get('limit')).toBe('26')
  expect(h.calls[0].url.searchParams.get('order')).toBe('created_at.desc,id.desc');expect(h.calls[0].url.searchParams.get('or')).toContain(raw().created_at)
  expect(h.calls[1].method).toBe('HEAD')
 })
 it('marks only reviewed IDs and confirms read-back instead of trusting an empty PATCH response',async()=>{
  const h=client(r=>r.method==='PATCH'?new Response(null,{status:204}):json([{id:id(),recipient_profile_id:owner,read_at:'2026-10-31T11:00:00Z'}]))
  const result=await markUpdatesRead(h.c,owner,()=>true,[id()]);expect(result[0].id).toBe(id());expect(h.calls.map(r=>r.method)).toEqual(['PATCH','GET'])
  expect(Object.keys(h.calls[0].body!)).toEqual(['read_at']);expect(h.calls[0].url.searchParams.get('id')).toBe('in.('+id()+')');expect(h.calls[0].url.searchParams.get('read_at')).toBe('is.null')
  for(const call of h.calls)expect(call.url.searchParams.get('recipient_profile_id')).toBe('eq.'+owner)
  const missing=client(r=>r.method==='PATCH'?new Response(null,{status:204}):json([]));await expect(markUpdatesRead(missing.c,owner,()=>true,[id()])).rejects.toThrow('not confirmed')
  for(const ids of [[],[id(),id()],['bad'],Array.from({length:101},(_,i)=>id(i))])await expect(markUpdatesRead(h.c,owner,()=>true,ids)).rejects.toThrow()
 })
 it('blocks stale views before transport and ignores an account change during a read or write',async()=>{
  const h=client(()=>json([raw()]));await expect(loadUpdates(h.c,owner,()=>false,{unread:false,category:'all'})).rejects.toThrow();expect(h.calls).toHaveLength(0)
  let switched=false
  const race=client(r=>{switched=true;return r.method==='PATCH'?new Response(null,{status:204}):json([raw()])})
  race.session.mockImplementation(async()=>({data:{session:{user:{id:switched?other:owner},access_token:switched?'account-B-token':'account-A-token'}},error:null}) as never)
  await expect(markUpdatesRead(race.c,owner,()=>true,[id()])).rejects.toThrow('Sign in again');expect(race.calls).toHaveLength(1);expect(race.calls[0].headers.get('Authorization')).toBe('Bearer account-A-token')
 })
})
describe('Updates app destinations',()=>{
 it('uses known content links and app tools, never a website or an auth/billing redirect',()=>{
  expect(updateAction(item())).toMatchObject({kind:'link',link:{kind:'tournament',id:'open-draw'}})
  expect(updateAction({...item(),href:'/mylab#coach-assignments'})).toMatchObject({kind:'tool',destination:'training-inbox'})
  expect(updateAction({...item(),href:'/level-up/serve?focus=first&card=spin#level-up-flow'})).toMatchObject({kind:'tool',destination:'training-inbox'})
  for(const href of ['https://evil.test/tournaments/a','//evil.test/tournaments/a','javascript:alert(1)','/login?next=/coach','/account','/api/auth/access','/messages?thread='+id()+'&thread='+id(2),'/coach?admin=true','https://user@www.tenaceiq.com/coach'])expect(updateAction({...item(),href})).toBeNull()
  expect(updateAction({...item(),href:'/messages?thread='+id(),conversationId:id(2)})).toBeNull()
 })
 it('resolves only an accessible exact Coach conversation; membership is checked again by the existing screen',async()=>{
  const action={kind:'conversation' as const,id:id(),label:'Open conversation'}
  const h=client(()=>json({id:id(),conversation_type:'direct',related_entity_type:'coach_student',related_entity_id:id(3)}))
  expect(await resolveUpdateAction(h.c,owner,()=>true,action)).toEqual({kind:'coach-message',student:id(3),label:'Open Coach messages'})
  expect(h.calls[0].url.searchParams.get('id')).toBe('eq.'+id())
  for(const value of [null,{id:id(),conversation_type:'support',related_entity_type:'coach_student',related_entity_id:id(3)},{id:id(2),conversation_type:'direct',related_entity_type:'coach_student',related_entity_id:id(3)}])await expect(resolveUpdateAction(client(()=>json(value)).c,owner,()=>true,action)).rejects.toThrow('unavailable')
 })
})
