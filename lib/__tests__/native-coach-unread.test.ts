import {beforeEach,afterEach,expect,it,vi} from 'vitest'
import {createClient,type SupabaseClient} from '@supabase/supabase-js'
const state=vi.hoisted(()=>({owner:'11111111-1111-4111-8111-111111111111',verified:true,client:{} as SupabaseClient}))
vi.mock('server-only',()=>({}))
vi.mock('../mobile-account-auth',()=>({verifiedAccount:async()=>state.verified?{user:{id:state.owner},token:'synthetic-owner-token'}:null,accountClient:()=>state.client,readAccountJson:async(r:Request)=>r.json()}))
vi.mock('../supabase-public-config',()=>({supabaseKey:'synthetic-public'}))
vi.mock('../native-chat-unread',()=>({nativeChatUnread:async()=>({owner:state.owner,total:7,teams:[]})}))
import {nativeCoachChatUnread,coachConversationId} from '../native-coach-chat-unread'
import {PATCH,GET as messages} from '../../app/api/mobile/coach/messages/route'
import {GET as counts} from '../../app/api/mobile/chats/unread/route'

const owner=state.owner,other='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',message='44444444-4444-4444-8444-444444444444',conversation=coachConversationId(id),time='2026-10-31T12:00:00.123456+00:00'
type Row=Record<string,unknown>
let links:Row[],rows:Row[],target:Row|null,fail:boolean,calls:{url:URL;method:string;body:unknown}[]
const link=()=>({id,coach_user_id:owner,player_user_id:other,status:'active'})
const row=()=>({id:conversation,conversation_type:'direct',related_entity_type:'coach_student',related_entity_id:id,status:'open',participants:[{profile_id:owner,last_read_at:'2026-10-31T12:00:00.123455+00:00'}],posts:[{id:message,conversation_id:conversation,sender_user_id:other,created_at:time,deleted_at:null}]})
function client(){return createClient('https://synthetic.invalid','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
 const url=new URL(String(input)),method=init?.method||'GET';calls.push({url,method,body:init?.body?JSON.parse(String(init.body)):null})
 if(fail)return Response.json({message:'Synthetic unavailable'},{status:503})
 if(method==='PATCH')return new Response(null,{status:204})
 if(url.pathname.endsWith('/coach_player_links'))return Response.json(links)
 if(url.pathname.endsWith('/internal_conversations'))return Response.json(rows)
 if(url.pathname.endsWith('/internal_messages'))return Response.json(target?[target]:[])
 throw Error('Unexpected data query')
 }}})}
const patch=(body:unknown={message},query='?student='+id)=>new Request('https://synthetic.invalid/api/mobile/coach/messages'+query,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{state.owner=owner;state.verified=true;links=[link()];rows=[row()];target={created_at:time};fail=false;calls=[];state.client=client();vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service');vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-01T00:00:00Z'))})
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks()})

it('batches current coach connections under RLS and returns counts without identities or message text',async()=>{
 expect(await nativeCoachChatUnread(state.client,owner)).toEqual({available:true,total:1,connections:[{id,unread:1,latest:message}]})
 expect(calls).toHaveLength(2)
 const first=calls[0].url.searchParams,second=calls[1].url.searchParams
 expect(first.get('or')).toBe('(coach_user_id.eq.'+owner+',player_user_id.eq.'+owner+')');expect(first.get('status')).toBe('neq.paused');expect(first.get('player_user_id')).toBe('not.is.null');expect(first.get('limit')).toBe('101')
 expect(second.get('participants.profile_id')).toBe('eq.'+owner);expect(second.get('posts.sender_user_id')).toBe('neq.'+owner);expect(second.get('posts.deleted_at')).toBe('is.null');expect(second.get('posts.limit')).toBe('100');expect(second.get('posts.order')).toBe('created_at.desc,id.desc');expect(second.get('select')).not.toMatch(/body|title|name/)
 expect(calls.every(c=>c.method==='GET')).toBe(true)
})
it('compares read checkpoints with microsecond precision and caps each badge at 99+',async()=>{
 rows[0].participants=[{profile_id:owner,last_read_at:time}];expect((await nativeCoachChatUnread(state.client,owner)).total).toBe(0)
 rows[0].participants=[{profile_id:owner,last_read_at:null}];rows[0].posts=Array.from({length:100},(_,i)=>({id:'55555555-5555-4555-8555-'+String(i).padStart(12,'0'),conversation_id:conversation,sender_user_id:other,created_at:time,deleted_at:null}));expect((await nativeCoachChatUnread(state.client,owner)).total).toBe(100)
})
it('returns known zero for no active connections or an uninitialized/inaccessible conversation without writes',async()=>{
 links=[];expect(await nativeCoachChatUnread(state.client,owner)).toEqual({available:true,total:0,connections:[]});expect(calls).toHaveLength(1)
 links=[link()];rows=[];expect((await nativeCoachChatUnread(state.client,owner)).connections).toEqual([{id,unread:0,latest:null}]);expect(calls.every(c=>c.method==='GET')).toBe(true)
})
it('rejects foreign/paused/duplicate links and cross-conversation or deleted message rows',async()=>{
 for(const changed of [{...link(),coach_user_id:other},{...link(),status:'paused'}]){links=[changed];await expect(nativeCoachChatUnread(state.client,owner)).rejects.toThrow()}
 links=[link(),link()];await expect(nativeCoachChatUnread(state.client,owner)).rejects.toThrow();links=[link()]
 for(const changed of [{...row(),related_entity_id:'other'},{...row(),participants:[{profile_id:other,last_read_at:null}]},{...row(),posts:[{...(row().posts[0]),conversation_id:other}]},{...row(),posts:[{...(row().posts[0]),sender_user_id:owner}]},{...row(),posts:[{...(row().posts[0]),deleted_at:time}]}]){rows=[changed];await expect(nativeCoachChatUnread(state.client,owner)).rejects.toThrow()}
})
it('fails unavailable on oversized lists, duplicate metadata or a source failure without retrying',async()=>{
 links=Array(101).fill(link());await expect(nativeCoachChatUnread(state.client,owner)).rejects.toThrow();links=[link()]
 rows=[row(),row()];await expect(nativeCoachChatUnread(state.client,owner)).rejects.toThrow();rows=[row()]
 fail=true;calls=[];await expect(nativeCoachChatUnread(state.client,owner)).rejects.toThrow();expect(calls).toHaveLength(1)
})
it('keeps the installed-build team total stable and adds separate coach counts; a coach outage preserves team counts',async()=>{
 const response=await counts(new Request('https://synthetic.invalid/api/mobile/chats/unread'));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ok:true,total:7,coach:{available:true,total:1,connections:[{id,unread:1}]}})
 fail=true;const unavailable=await counts(new Request('https://synthetic.invalid/api/mobile/chats/unread'));expect(await unavailable.json()).toMatchObject({ok:true,total:7,coach:{available:false,total:0,connections:[]}})
})
it('authenticates read acknowledgements before querying data and rejects account/timestamp injection',async()=>{
 state.verified=false;expect((await PATCH(patch())).status).toBe(401);expect(calls).toHaveLength(0);state.verified=true
 for(const request of [patch({message,owner:other}),patch({message,lastReadAt:'2099-01-01'}),patch({message:'../invalid'}),patch({message},'?student='+id+'&owner='+other),patch({message},'?student='+id+'&student='+id)])expect((await PATCH(request)).status).toBe(400)
 expect(calls).toHaveLength(0)
})
it('advances only the current participant to the exact database message checkpoint and never changes mute/role',async()=>{
 const response=await PATCH(patch());expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(await response.json()).toEqual({ok:true,owner,student:id,through:message})
 const update=calls.find(c=>c.method==='PATCH')!;expect(update.body).toEqual({last_read_at:time});expect(update.url.searchParams.get('conversation_id')).toBe('eq.'+conversation);expect(update.url.searchParams.get('profile_id')).toBe('eq.'+owner);expect(update.url.searchParams.get('or')).toBe('(last_read_at.is.null,last_read_at.lt.'+time+')')
 const targetCall=calls.find(c=>c.url.pathname.endsWith('/internal_messages'))!;expect(targetCall.url.searchParams.get('id')).toBe('eq.'+message);expect(targetCall.url.searchParams.get('conversation_id')).toBe('eq.'+conversation)
})
it('rejects paused, removed, foreign or mismatched conversations and missing message targets without a read write',async()=>{
 links=[{...link(),status:'paused'}];expect((await PATCH(patch())).status).toBe(404);links=[{...link(),coach_user_id:other}];expect((await PATCH(patch())).status).toBe(404);links=[link()]
 for(const changed of [{...row(),participants:[]},{...row(),participants:[{profile_id:other}]},{...row(),related_entity_id:'foreign'}]){rows=[changed];expect((await PATCH(patch())).status).toBe(404)}
 rows=[row()];target=null;expect((await PATCH(patch())).status).toBe(404);expect(calls.some(c=>c.method==='PATCH')).toBe(false)
})
it('keeps GET a read-only operation and read-update failures explicit',async()=>{
 await messages(new Request('https://synthetic.invalid/api/mobile/coach/messages?student='+id));expect(calls.some(c=>c.method!=='GET')).toBe(false)
 fail=true;expect((await PATCH(patch())).status).toBe(503)
})

it('projects the latest eligible incoming message even when already read, without another query',async()=>{
 rows[0].participants=[{profile_id:owner,last_read_at:'2026-11-01T00:00:00Z'}]
 const previous={...row().posts[0],id:'55555555-5555-4555-8555-555555555555',created_at:'2026-10-31T12:00:00.123455+00:00'}
 rows[0].posts=[previous,row().posts[0]]
 expect((await nativeCoachChatUnread(state.client,owner)).connections).toEqual([{id,unread:0,latest:message}])
 expect(calls).toHaveLength(2);expect(calls.every(c=>c.method==='GET')).toBe(true)
})
